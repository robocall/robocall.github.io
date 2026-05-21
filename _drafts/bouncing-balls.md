---
layout: post
title: "Making sure what your code does you think it does, with Vet"
date: 2026-05-21
tags: [vet, ai, debugging, p5js, interactive]
---
The biggest issue I run into as a software engineer is when my code doesn't do what I *think* it does. 

I’ve been trying [**Vet**](https://github.com/imbue-ai/vet). Vet reviews your git diff plus a commit message, and asks an LLM whether your code change matches what you wanted. 

In this walkthrough, I briefly go over how I set up and used vet to debug a deliberately broken p5.js sketch. Overall, I found it easy to use and surprising effective!

## The sketch

I wanted the sketch to show a simple ball that bounces off the edges of the canvas.

On the right is the relevant p5.js code and on the left is the sketch working in the happy case. First, see if you can find the bug!

<div class="bouncing-balls-t">
  <div class="bouncing-balls-t__top">
    <div class="bouncing-balls-t__demo">
      <div id="canvas-wrap-square"></div>
    </div>
    <div class="bouncing-balls-t__code">
{% highlight js linenos %}
function draw() {
  background(30, 32, 36);

  ball_position_x += ball_velocity_x;
  ball_position_y += ball_velocity_y;

  if (
    ball_position_x + ball_radius > width
    || ball_position_x - ball_radius < 0
  ) {
    ball_velocity_x *= -1;
  }

  if (
    ball_position_y + ball_radius > width
    || ball_position_y - ball_radius < 0
  ) {
    ball_velocity_y *= -1;
  }

  fill(249, 145, 57);
  noStroke();
  circle(ball_position_x, ball_position_y, ball_radius * 2);
}
{% endhighlight %}
    </div>
  </div>
</div>

As a hint, here's the unhappy case—the bug shows up on a wide, short canvas:

<div class="bouncing-balls-t__bottom">
  <div id="canvas-wrap-buggy"></div>
</div>

If you found the bug in line 15, you're right! The ball position should check against height, not width, in the y axis. 

I liked this as an example since this is the perfect use case for Vet: code that seems to work but fails on edge cases. Let's see if Vet can find the bug.

## Installing and running Vet

Vet is super easy to install. 
```bash
pip install verify-everything
```

Vet also needs a model. To keep it free, I used a [free Gemini key](https://ai.google.dev/gemini-api/docs/quickstart). You can also use an Anthropic or OpenAI API key, or `--agentic` to route through Claude Code / Codex / OpenCode. 

```bash
export GOOGLE_API_KEY="…"

vet "Bouncing ball that collides and bounces off the walls of the canvas" \
  --model gemini-2.5-flash
```

The "goal string" is what you'd write in a PR description, and Vet compares it to the diff.

Vet took 90 seconds to run on my M3 Macbook Pro. It returned:
```
analyzing /Users/.../imbue (relative to HEAD)

🔴 Vet Issue `logic_error` *severity: 5/5*, *confidence: 1.00*
  bouncing-balls/sketch.js:26
  The vertical collision detection logic incorrectly compares `ball_position_y + ball_radius` against `width` instead of `height` for the bottom edge of the canvas. This causes the ball to pass beyond the visible bottom boundary on non-square canvases. This also means the user's request for a bouncing ball that "bounces off the walls of the canvas" is not fully met with correct functionality.
```
Vet found the bug! Vet itself doesn't fix bugs, but you can ask your coding agent like Cursor to "fix the issue Vet flagged." In my case, Cursor was able to fix it.


Vet also returned some other interesting flags. While the root cause of these errors is "mess" from my development process and writing this blog, I still think it's interesting to look at, as an artifact for thinking about what else Vet is capable of. 

Some of my setup files got pulled into my commit. Vet correctly flagged these as not relevant to the commit. Interestingly, "commit message mismatch" seems more about the scope of the PR, whereas the previous "logic error" capture actual bugs in the code.
```
🔴 Vet Issue `commit_message_mismatch` *severity: 3/5*, *confidence: 1.00*
  The diff introduces numerous files related to the `vet` skill and its configuration across multiple agent harness directories. These additions are outside the scope of the user's request, which was specifically to implement a "bouncing ball that collides and bounces off the walls of the canvas".
```

I left a comment in my actual code to remind myself what the intended bug was, and Vet flagged it. In larger projects, this would be great as a linter / code hygiene.
```
🔴 Vet Issue `user_request_artifacts_left_in_code` *severity: 1/5*, *confidence: 1.00*
  bouncing-balls/sketch.js:27
  The inline comment `// bug: lower edge should compare to height, not width` explicitly points out a known bug rather than describing the correct, intended behavior of the code. This is an artifact of the development or bug-finding process, not a description of the final, correct implementation.
```

I'm curious to see how different models perform with Vet, and testing Vet on a larger (open source?) codebase to see if it uncovers bugs that were previously unknown. Vet seems like a natural extension of fuzz testing, and I can see it finding interesting security/privacy bugs. Stay tuned for a follow up blog post, and I would love to hear your use cases as well! 

<script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.11.3/p5.min.js"></script>
<script src="{{ '/assets/posts/bouncing-balls/sketch.js' | relative_url }}" defer></script>
