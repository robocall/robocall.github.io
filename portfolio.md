---
layout: page
title: Portfolio
---

## Selected works

{% capture vet_tags %}{% include pill_tags.html tags="blog|AI|interactive" %}{% endcapture %}
{% include portfolio_item.html
  title="Debugging a bouncing ball with Vet"
  url="/bouncing-balls"
  img="/assets/portfolio/bouncing-balls.png"
  alt="Bouncing ball p5.js demo with code snippet"
  tags=vet_tags
  desc="Interactive blog post: a deliberately broken p5.js sketch, finding the edge-case bug with Imbue Vet and Gemini, with live demos and highlighted code."
%}

{% capture cli_tags %}{% include pill_tags.html tags="dev tools|AI" %}{% endcapture %}
{% include portfolio_item.html
  title="Context-preserving translation for long texts with LLMs"
  url="https://github.com/robocall/ai-book-translate"
  img="/assets/portfolio/cli-translate.png"
  alt="Book translation CLI"
  tags=cli_tags
  desc="Python CLI to chunk and feed a text into a locally run LLM while preserving context. LLM is run locally via Ollama. I authored both the code and docs."
%}


{% capture ol_tags %}{% include pill_tags.html tags="tutorial|open source" %}{% endcapture %}
{% include portfolio_item.html
  title="How to use Open Library Search"
  url="https://openlibrary.org/search/howto"
  img="/assets/portfolio/openlibrary.png"
  alt="Open Library search docs"
  tags=ol_tags
  desc="Tutorial on search query syntax and JSON APIs. Demo on curating a high-school civil rights reading list from metadata."
%}


## Beyond the repo

{% capture zine_tags %}{% include pill_tags.html tags="workshop|creative|public education" %}{% endcapture %}
{% include portfolio_item.html
  title="Surveillance infrastructure walking tour and zine"
  url="https://coveillance.org/a-walking-tour-of-surveillance-infrastructure-in-seattle/#id-acyclica-118"
  img="/assets/portfolio/zine.png"
  alt="Zine thumbnail"
  tags=zine_tags
  desc="Public education workshop about surveillance technology, with a print zine containing educational activities explaining targeted ad tracking, WiFi sniffing, and applications of OCR."
%}

