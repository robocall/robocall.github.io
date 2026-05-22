---
layout: post
title: "trolley problems"
date: 2026-04-22
tags: [ai, evals, ethics, llms]
---

## TL;DR

- What you’re evaluating
- What “good” means
- How you measure it
- How you avoid fooling yourself

## Why evals are hard

## A minimal eval stack

### 1) A task spec

### 2) A dataset (and a story for how it was collected)

### 3) A metric (or rubric)

### 4) A harness that’s boring and correct

## Common failure modes

## My checklist

## Score plane

Below: three **score planes** (ChatGPT, Claude, DeepSeek) on the same fifty prompts, then a **dumbbell** view: for each highlighted prompt, a segment from the lowest to the highest stance among the three models, with one dot per model. Axes use a **fixed 1–5** scale so everything lines up.

<div id="ml-evals-viz"></div>
<script src="{{ '/assets/posts/ml-evals/viz.js' | relative_url }}" defer></script>

