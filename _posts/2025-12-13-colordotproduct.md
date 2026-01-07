---
layout: post
title: a failed attempt at using vector calculus for color spaces
date: 2025-12-08
tags: [code, interactive]
---

I wanted a lazy way to autogenerate thumbnails that with brightly colored text that contrasted against a colored background.

I thought:
* Colors are represented as vectors in RGB space
* Vector dot product tells you how different two vectors are

I was hyped that vector calculus was actually useful for once. I wrote a script to generate random colors and check them against a dot product threshold. You may have predicted that this doesn't work, but it's kind of counterintuitive!

If RGB is a vector that represents color, why wouldn't dot product, which represents the difference between vectors, work as "difference between colors"?

It's because RGB values represent the amount of "red/green/blue light", which is unrelated to "how the eye perceive readability."

Ignoring blue for now, we'll look at examples red-green space.
Below are examples:
*  with small dot products: green text on red background (readable); and dark text on dark background (not readable).
*  with large dot products: yellow text on dark background (readable); and two similar reds (not readable)




<div style="position: relative; display: inline-block;">

<canvas id="vectorMap" width="256" height="256"></canvas>
<svg id="vectorSVG" width="256" height="256"
  style="position: absolute; top: 0; left: 0; pointer-events: none;"></svg>


<div style="margin-bottom: 10px;">
    <button id="example1" style="margin-right: 10px; padding: 5px 10px;font-family:inherit">Example 1: Small dot product, good
      contrast</button>
    <button id="example2" style="margin-right: 10px; padding: 5px 10px;font-family:inherit">Example 2: Small dot product, good
      contrast</button>
    <button id="example3" style="margin-right: 10px; padding: 5px 10px;font-family:inherit">Example 3: Large dot product, poor
      contrast</button>
    <button id="example4" style="margin-right: 10px; padding: 5px 10px;font-family:inherit">Example 4: Small dot product, poor
      contrast</button>
</div>


  <div id="exampleDisplay" style="margin-top: 10px; padding: 10px; min-height: 50px; background: transparent;"></div>
</div>


<script src="/blogpostscode/color.js"></script>

So RGB vectors aren't very meaningful by themselves. The correct calculation here would be luminance, which is the perceived brightness of an RGB color, and calculated by (0.2126*R + 0.7152*G + 0.0722*B). The magic constants are derived from the colors that the human eye is most sensitive to.
