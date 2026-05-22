/**
 * Ethics score planes, dumbbell chart, and ChatGPT vs Claude overlaid score plane.
 *
 * In your post Markdown:
 *   <div id="ml-evals-viz"></div>
 *   <script src="{{ '/assets/posts/ml-evals/viz.js' | relative_url }}" defer></script>
 */
(function () {
  const rootId = "ml-evals-viz";

  /** Shared rubric / confidence scale (integer grid, comparable across models). */
  const AXIS_MIN = 1;
  const AXIS_MAX = 5;
  const EDGE_PAD = 0.06;
  const OVERLAP_JITTER_PX = 2.5;

  /** @typedef {{ id: string, question: string, answer: string, score: number, conf: number }} Row */

  /** @typedef {{ file: string, title: string, blurb: string, rgb: [number, number, number], panelClass: string }} ChartSpec */

  const CHARTS = /** @type {ChartSpec[]} */ ([
    {
      file: "ethics_50_questions_answers_scores.csv",
      title: "ChatGPT — score plane (50 dilemmas)",
      blurb:
        "Stance (utilitarian→deontological) vs confidence. Axes are fixed 1–5 on both dimensions so the three panels line up. Hover or focus a point for the prompt and excerpt.",
      rgb: [0, 240, 255],
      panelClass: "",
    },
    {
      file: "ethics_answers_chatgpt_graded_deontological.csv",
      title: "Claude — score plane (50 dilemmas)",
      blurb:
        "Same fifty prompts on the same grid (violet). Stance uses `chatgpt_graded_deontological`; confidence is the model’s self-rating from the sheet.",
      rgb: [196, 167, 255],
      panelClass: "ml-evals-viz__panel--claude",
    },
    {
      file: "ethics_deepseek.csv",
      title: "DeepSeek — score plane (50 dilemmas)",
      blurb:
        "Same grid. Stance comes from `spectrum_score` in the export (same rubric direction as the others).",
      rgb: [120, 185, 255],
      panelClass: "ml-evals-viz__panel--deepseek",
    },
  ]);

  const FILE_GPT = "ethics_50_questions_answers_scores.csv";
  const FILE_CLAUDE = "ethics_answers_chatgpt_graded_deontological.csv";
  const FILE_DEEPSEEK = "ethics_deepseek.csv";
  const DUMBBELL_TOP_N = 18;
  /** How many prompts to list beside the ChatGPT vs Claude overlay (by largest |stance delta|). */
  const OVERLAY_GPT_CLAUDE_TOP_N = 16;

  const MODEL_RGB = {
    gpt: [0, 240, 255],
    claude: [196, 167, 255],
    deepseek: [120, 185, 255],
  };

  function fract(x) {
    return x - Math.floor(x);
  }

  /**
   * Stable per-seed fill for the ChatGPT vs Claude overlay only: mix toward dark ground + varied alpha.
   * @param {number} R
   * @param {number} G
   * @param {number} B
   * @param {number} seed
   */
  function perturbedModelFill(R, G, B, seed) {
    const Br = 7;
    const Bg = 9;
    const Bb = 16;
    const u = fract(Math.sin(seed * 12.9898) * 43758.5453);
    const v = fract(Math.sin((seed + 41.2) * 45.164) * 9918.14673);
    const mixBg = 0.2 + u * 0.45;
    const r = Math.round(R * (1 - mixBg) + Br * mixBg);
    const g = Math.round(G * (1 - mixBg) + Bg * mixBg);
    const b = Math.round(B * (1 - mixBg) + Bb * mixBg);
    const a = 0.34 + v * 0.42;
    return `rgba(${r},${g},${b},${a.toFixed(2)})`;
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const n = text[i + 1];
      if (inQ) {
        if (c === '"' && n === '"') {
          cur += '"';
          i++;
        } else if (c === '"') {
          inQ = false;
        } else {
          cur += c;
        }
      } else if (c === '"') {
        inQ = true;
      } else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && n === "\n") i++;
        row.push(cur);
        cur = "";
        if (row.some((cell) => String(cell).length)) rows.push(row);
        row = [];
      } else {
        cur += c;
      }
    }
    row.push(cur);
    if (row.some((cell) => String(cell).length)) rows.push(row);
    return rows;
  }

  /**
   * Rejoin over-split rows when `answer` contains commas but was not quoted.
   * @param {string[]} row
   */
  function normalizeRow(row, headerLen) {
    if (row.length <= headerLen) return row;
    if (headerLen === 4) {
      return [
        row[0],
        row.slice(1, -2).join(","),
        row[row.length - 2],
        row[row.length - 1],
      ];
    }
    if (headerLen >= 5) {
      const nTail = headerLen - 2;
      return [
        row[0],
        row.slice(1, row.length - nTail).join(","),
        ...row.slice(row.length - nTail),
      ];
    }
    return row;
  }

  /** @param {string[][]} table */
  function tableToObjects(table) {
    if (!table.length) return [];
    const header = table[0].map((h) => h.trim().toLowerCase());
    const iq = header.indexOf("question");
    const iid = header.indexOf("id");
    const ia = header.findIndex(
      (h) =>
        h === "answer" ||
        h === "chatgpt_answer" ||
        h === "deepseek_answer" ||
        (h.includes("chatgpt") && h.includes("answer")) ||
        (h.includes("deepseek") && h.includes("answer"))
    );
    const igraded = header.findIndex(
      (h) => h.includes("graded") && h.includes("deontological")
    );
    const iscoreFallback = header.findIndex(
      (h) =>
        (h.includes("my_deepseek") && h.includes("deontological")) ||
        (h.includes("utilitarian") && h.includes("deontological")) ||
        h.includes("utilitarian_to_deontological") ||
        h.includes("spectrum_score") ||
        (h.includes("spectrum") && h.includes("score"))
    );
    const iscore = igraded >= 0 ? igraded : iscoreFallback;
    const iconf = header.findIndex(
      (h) =>
        h.includes("self_confidence") ||
        (h.includes("confidence") && !h.includes("utilitarian"))
    );
    if (iq < 0 || ia < 0 || iscore < 0 || iconf < 0) return [];

    const out = [];
    for (let r = 1; r < table.length; r++) {
      const row = normalizeRow(table[r], header.length);
      if (row.length < header.length) continue;
      const score = Number(row[iscore]);
      const conf = Number(row[iconf]);
      if (Number.isNaN(score) || Number.isNaN(conf)) continue;
      out.push({
        id: iid >= 0 ? String(row[iid] || "").trim() : String(out.length + 1),
        question: row[iq] || "",
        answer: row[ia] || "",
        score,
        conf,
      });
    }
    return out;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  const OG_ANS_POP_CHAR_MAX = 520;

  function clearOgAnsPops() {
    document.querySelectorAll(".ml-evals-viz__og-ans-pop").forEach((n) => n.remove());
  }

  /**
   * Fixed popups with each model’s answer (question hover). Stacked column beside or
   * below the dot cluster so boxes do not overlap each other or the circles.
   * @param {SVGSVGElement} svg
   * @param {string} pairIdxStr
   * @param {Row} g
   * @param {Row} c
   */
  function showOgAnsPopsNearDots(svg, pairIdxStr, g, c) {
    clearOgAnsPops();
    const specs = [
      {
        cls: "ml-evals-viz__pt--og-gpt",
        lab: "ChatGPT",
        row: g,
        model: "gpt",
      },
      {
        cls: "ml-evals-viz__pt--og-claude",
        lab: "Claude",
        row: c,
        model: "claude",
      },
    ];
    const items = [];
    for (const s of specs) {
      const circ = svg.querySelector(`circle.${s.cls}[data-pair="${pairIdxStr}"]`);
      if (!circ) continue;
      items.push({ spec: s, circ, rect: circ.getBoundingClientRect() });
    }
    if (!items.length) return;
    items.sort((a, b) => a.rect.left - b.rect.left);

    let minL = Infinity;
    let maxR = -Infinity;
    let minT = Infinity;
    let maxB = -Infinity;
    for (const { rect } of items) {
      minL = Math.min(minL, rect.left);
      maxR = Math.max(maxR, rect.right);
      minT = Math.min(minT, rect.top);
      maxB = Math.max(maxB, rect.bottom);
    }
    const midX = (minL + maxR) / 2;
    const midY = (minT + maxB) / 2;

    const maxPopW = Math.min(280, window.innerWidth * 0.42);
    /** @type {HTMLElement[]} */
    const pops = [];
    for (const { spec } of items) {
      const pop = document.createElement("div");
      pop.className = `ml-evals-viz__og-ans-pop ml-evals-viz__og-ans-pop--${spec.model}`;
      pop.style.maxWidth = `${maxPopW}px`;
      pop.style.visibility = "hidden";
      pop.style.left = "-9999px";
      pop.style.top = "0";
      pop.style.transform = "none";
      const lab = document.createElement("div");
      lab.className = "ml-evals-viz__og-ans-pop-lab";
      lab.textContent = spec.lab;
      const body = document.createElement("div");
      body.className = "ml-evals-viz__og-ans-pop-body";
      const a = spec.row.answer || "";
      body.textContent =
        a.length > OG_ANS_POP_CHAR_MAX
          ? `${a.slice(0, OG_ANS_POP_CHAR_MAX - 1)}…`
          : a;
      pop.appendChild(lab);
      pop.appendChild(body);
      pop.setAttribute("role", "tooltip");
      document.body.appendChild(pop);
      pops.push(pop);
    }

    requestAnimationFrame(() => {
      const heights = pops.map((p) => p.offsetHeight);
      const widths = pops.map((p) => p.offsetWidth);
      const colW = Math.max(...widths, 1);
      const gap = 10;
      const margin = 12;
      const pad = 8;
      const ww = window.innerWidth;
      const wh = window.innerHeight;
      const totalH =
        heights.reduce((s, h) => s + h, 0) + gap * Math.max(0, heights.length - 1);

      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

      let left = 0;
      let top = 0;
      let placed = false;

      if (maxR + margin + colW <= ww - pad) {
        left = maxR + margin;
        top = clamp(midY - totalH / 2, pad, wh - pad - totalH);
        placed = true;
      } else if (minL - margin - colW >= pad) {
        left = minL - margin - colW;
        top = clamp(midY - totalH / 2, pad, wh - pad - totalH);
        placed = true;
      }

      if (!placed) {
        left = clamp(midX - colW / 2, pad, ww - pad - colW);
        top = maxB + margin;
        if (top + totalH > wh - pad) {
          top = minT - margin - totalH;
        }
        top = clamp(top, pad, wh - pad - totalH);
      }

      let y = top;
      for (let i = 0; i < pops.length; i++) {
        const p = pops[i];
        p.style.left = `${left}px`;
        p.style.top = `${y}px`;
        p.style.transform = "none";
        p.style.visibility = "visible";
        y += heights[i] + gap;
      }
    });
  }

  /** Signed display nudge (data units), small spread for stacked points. */
  function randomDisplayNudge() {
    const mag = 0.005 + Math.random() * 0.02;
    return (Math.random() < 0.5 ? -1 : 1) * mag;
  }

  /** @param {Row[]} rows */
  function jitterForRows(rows) {
    const map = new Map();
    rows.forEach((p, i) => {
      const key = `${p.score}|${p.conf}`;
      const same = rows.filter((q) => `${q.score}|${q.conf}` === key);
      const before = rows.slice(0, i).filter((q) => `${q.score}|${q.conf}` === key)
        .length;
      const off =
        same.length > 1
          ? (before - (same.length - 1) / 2) * OVERLAP_JITTER_PX
          : 0;
      map.set(i, off);
    });
    return map;
  }

  /**
   * @param {HTMLElement} panel
   * @param {Row[]} rows
   * @param {{ showTip: (h: string, x: number, y: number) => void, hideTip: () => void }} tip
   * @param {ChartSpec} spec
   * @param {string} clipId
   */
  function renderPlane(panel, rows, tip, spec, clipId) {
    const [R, G, B] = spec.rgb;
    const jitter = jitterForRows(rows);

    let xLo = AXIS_MIN - EDGE_PAD;
    let xHi = AXIS_MAX + EDGE_PAD;
    let yLo = AXIS_MIN - EDGE_PAD;
    let yHi = AXIS_MAX + EDGE_PAD;

    const W = 560;
    const H = 460;
    const m = { l: 48, r: 22, t: 20, b: 56 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;

    const sx = (v) => m.l + ((v - xLo) / (xHi - xLo)) * iw;
    const sy = (v) => m.t + ih - ((v - yLo) / (yHi - yLo)) * ih;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "ml-evals-viz__svg");
    svg.setAttribute("aria-label", `${spec.title}: stance versus confidence, axes 1–5`);

    const defs = document.createElementNS(svgNS, "defs");
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipRect = document.createElementNS(svgNS, "rect");
    clipRect.setAttribute("x", String(m.l));
    clipRect.setAttribute("y", String(m.t));
    clipRect.setAttribute("width", String(iw));
    clipRect.setAttribute("height", String(ih));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const gGrid = document.createElementNS(svgNS, "g");
    for (let t = AXIS_MIN; t <= AXIS_MAX; t++) {
      const lx = sx(t);
      const v = document.createElementNS(svgNS, "line");
      v.setAttribute("x1", String(lx));
      v.setAttribute("x2", String(lx));
      v.setAttribute("y1", String(m.t));
      v.setAttribute("y2", String(m.t + ih));
      v.setAttribute("class", "ml-evals-viz__axis");
      gGrid.appendChild(v);
    }
    for (let t = AXIS_MIN; t <= AXIS_MAX; t++) {
      const ly = sy(t);
      const hln = document.createElementNS(svgNS, "line");
      hln.setAttribute("y1", String(ly));
      hln.setAttribute("y2", String(ly));
      hln.setAttribute("x1", String(m.l));
      hln.setAttribute("x2", String(m.l + iw));
      hln.setAttribute("class", "ml-evals-viz__axis");
      gGrid.appendChild(hln);
    }
    svg.appendChild(gGrid);

    const gPts = document.createElementNS(svgNS, "g");
    gPts.setAttribute("clip-path", `url(#${clipId})`);

    rows.forEach((r, i) => {
      const plotX = r.score + randomDisplayNudge();
      const plotY = r.conf + randomDisplayNudge();
      const cx = sx(plotX) + (jitter.get(i) || 0);
      const cy = sy(plotY);
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", "5");
      let ptClass = "ml-evals-viz__pt";
      if (spec.panelClass.includes("claude")) ptClass += " ml-evals-viz__pt--claude";
      if (spec.panelClass.includes("deepseek")) ptClass += " ml-evals-viz__pt--deepseek";
      c.setAttribute("class", ptClass);
      const ta = 0.35 + (i / Math.max(1, rows.length - 1)) * 0.45;
      c.setAttribute("fill", `rgba(${R}, ${G}, ${B}, ${ta.toFixed(2)})`);
      c.setAttribute("tabindex", "0");

      const qShort =
        r.question.length > 200 ? `${r.question.slice(0, 197)}…` : r.question;
      const ansShort =
        r.answer.length > 220 ? `${r.answer.slice(0, 217)}…` : r.answer;

      function tipHtml() {
        return (
          `<q>${esc(qShort)}</q>` +
          `<span class="ml-evals-viz__tip-line">#${esc(r.id)} · stance ${esc(
            r.score
          )} · confidence ${esc(r.conf)}</span>` +
          `<span class="ml-evals-viz__tip-line">${esc(ansShort)}</span>`
        );
      }

      c.addEventListener("mouseenter", (ev) => {
        c.classList.add("ml-evals-viz__pt--hi");
        tip.showTip(tipHtml(), ev.clientX, ev.clientY);
      });
      c.addEventListener("mousemove", (ev) => {
        tip.showTip(tipHtml(), ev.clientX, ev.clientY);
      });
      c.addEventListener("mouseleave", () => {
        c.classList.remove("ml-evals-viz__pt--hi");
        tip.hideTip();
      });
      c.addEventListener("focus", () => {
        c.classList.add("ml-evals-viz__pt--hi");
        const br = c.getBoundingClientRect();
        tip.showTip(tipHtml(), br.left + br.width / 2, br.top);
      });
      c.addEventListener("blur", () => {
        c.classList.remove("ml-evals-viz__pt--hi");
        tip.hideTip();
      });
      gPts.appendChild(c);
    });
    svg.appendChild(gPts);

    const xl = document.createElementNS(svgNS, "text");
    xl.setAttribute("x", String(W / 2));
    xl.setAttribute("y", String(H - 36));
    xl.setAttribute("text-anchor", "middle");
    xl.setAttribute("class", "ml-evals-viz__lbl");
    xl.textContent = "Rubric stance: utilitarian ←————————→ deontological";
    svg.appendChild(xl);

    const xl2 = document.createElementNS(svgNS, "text");
    xl2.setAttribute("x", String(W / 2));
    xl2.setAttribute("y", String(H - 22));
    xl2.setAttribute("text-anchor", "middle");
    xl2.setAttribute("class", "ml-evals-viz__lbl");
    xl2.textContent = "(fixed axis 1–5; higher → more deontology-framed)";
    svg.appendChild(xl2);

    const xl3 = document.createElementNS(svgNS, "text");
    xl3.setAttribute("x", String(W / 2));
    xl3.setAttribute("y", String(H - 8));
    xl3.setAttribute("text-anchor", "middle");
    xl3.setAttribute("class", "ml-evals-viz__lbl");
    xl3.textContent = "Dots use tiny random nudge for visibility; tooltip shows scored values.";
    svg.appendChild(xl3);

    const yl = document.createElementNS(svgNS, "text");
    yl.setAttribute("x", "12");
    yl.setAttribute("y", String(m.t + ih / 2));
    yl.setAttribute("text-anchor", "middle");
    yl.setAttribute("transform", `rotate(-90 12 ${m.t + ih / 2})`);
    yl.setAttribute("class", "ml-evals-viz__lbl");
    yl.textContent = "Confidence (1–5)";
    svg.appendChild(yl);

    const wrap = document.createElement("div");
    wrap.className = "ml-evals-viz__svg-wrap";
    wrap.appendChild(svg);
    panel.appendChild(wrap);
  }

  function normQuestion(s) {
    return String(s || "")
      .trim()
      .replace(/\s+/g, " ")
      .replace(/\u2018|\u2019/g, "'")
      .replace(/\u201c|\u201d/g, '"');
  }

  /**
   * @param {Row[]} gRows
   * @param {Row[]} cRows
   * @param {Row[]} dRows
   * @returns {{ pairIdx: number, question: string, g: Row, c: Row, d: Row }[]}
   */
  function alignTripleRows(gRows, cRows, dRows) {
    const n = Math.min(gRows.length, cRows.length, dRows.length);
    if (
      gRows.length === cRows.length &&
      cRows.length === dRows.length &&
      n > 0
    ) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        const qg = normQuestion(gRows[i].question);
        if (
          qg !== normQuestion(cRows[i].question) ||
          qg !== normQuestion(dRows[i].question)
        ) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return gRows.map((g, i) => ({
          pairIdx: i,
          question: g.question,
          g,
          c: cRows[i],
          d: dRows[i],
        }));
      }
    }
    const cmap = new Map(cRows.map((r) => [normQuestion(r.question), r]));
    const dmap = new Map(dRows.map((r) => [normQuestion(r.question), r]));
    const out = [];
    let pairIdx = 0;
    for (const g of gRows) {
      const k = normQuestion(g.question);
      const c = cmap.get(k);
      const d = dmap.get(k);
      if (!c || !d) continue;
      out.push({
        pairIdx: pairIdx++,
        question: g.question,
        g,
        c,
        d,
      });
    }
    return out;
  }

  /**
   * @param {Row[]} gRows
   * @param {Row[]} cRows
   * @returns {{ pairIdx: number, question: string, g: Row, c: Row }[]}
   */
  function alignGptClaudeRows(gRows, cRows) {
    const n = Math.min(gRows.length, cRows.length);
    if (n > 0 && gRows.length === cRows.length) {
      let ok = true;
      for (let i = 0; i < n; i++) {
        if (
          normQuestion(gRows[i].question) !== normQuestion(cRows[i].question)
        ) {
          ok = false;
          break;
        }
      }
      if (ok) {
        return gRows.map((g, i) => ({
          pairIdx: i,
          question: g.question,
          g,
          c: cRows[i],
        }));
      }
    }
    const cmap = new Map(cRows.map((r) => [normQuestion(r.question), r]));
    const out = [];
    let pairIdx = 0;
    for (const g of gRows) {
      const c = cmap.get(normQuestion(g.question));
      if (!c) continue;
      out.push({
        pairIdx: pairIdx++,
        question: g.question,
        g,
        c,
      });
    }
    return out;
  }

  /**
   * @param {HTMLElement} panel
   * @param {{ question: string, gpt: number, claude: number, deepseek: number }[]} triples
   * @param {{ showTip: (h: string, x: number, y: number) => void, hideTip: () => void }} tip
   */
  function renderDumbbellChart(panel, triples, tip) {
    const enriched = triples
      .map((t) => {
        const lo = Math.min(t.gpt, t.claude, t.deepseek);
        const hi = Math.max(t.gpt, t.claude, t.deepseek);
        return { ...t, lo, hi, spread: hi - lo };
      })
      .sort((a, b) => b.spread - a.spread)
      .slice(0, DUMBBELL_TOP_N);
    if (!enriched.length) return;

    const xLo = AXIS_MIN - EDGE_PAD;
    const xHi = AXIS_MAX + EDGE_PAD;
    const rowH = 30;
    const labelW = 200;
    const plotLeft = labelW + 10;
    const plotRight = 548;
    const plotW = plotRight - plotLeft;
    const topM = 28;
    const botM = 44;
    const W = 560;
    const H = topM + enriched.length * rowH + botM;

    const sx = (v) => plotLeft + ((v - xLo) / (xHi - xLo)) * plotW;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "ml-evals-viz__svg ml-evals-viz__svg--dumbbell");
    svg.setAttribute(
      "aria-label",
      "Dumbbell chart of stance spread across ChatGPT Claude and DeepSeek"
    );

    const axisY = H - 22;
    const gridG = document.createElementNS(svgNS, "g");
    for (let t = AXIS_MIN; t <= AXIS_MAX; t++) {
      const gx = sx(t);
      const vl = document.createElementNS(svgNS, "line");
      vl.setAttribute("x1", String(gx));
      vl.setAttribute("x2", String(gx));
      vl.setAttribute("y1", String(topM - 4));
      vl.setAttribute("y2", String(axisY));
      vl.setAttribute("class", "ml-evals-viz__axis");
      gridG.appendChild(vl);
      const tick = document.createElementNS(svgNS, "text");
      tick.setAttribute("x", String(gx));
      tick.setAttribute("y", String(H - 6));
      tick.setAttribute("text-anchor", "middle");
      tick.setAttribute("class", "ml-evals-viz__db-tick");
      tick.textContent = String(t);
      gridG.appendChild(tick);
    }
    const hAxis = document.createElementNS(svgNS, "line");
    hAxis.setAttribute("x1", String(plotLeft));
    hAxis.setAttribute("x2", String(plotRight));
    hAxis.setAttribute("y1", String(axisY));
    hAxis.setAttribute("y2", String(axisY));
    hAxis.setAttribute("class", "ml-evals-viz__axis");
    gridG.appendChild(hAxis);
    svg.appendChild(gridG);

    const pxNudge = { gpt: -4, claude: 0, deepseek: 4 };

    enriched.forEach((row, i) => {
      const y = topM + i * rowH + rowH / 2;
      const gEl = document.createElementNS(svgNS, "g");
      gEl.setAttribute("class", "ml-evals-viz__db-row");
      gEl.style.cursor = "pointer";

      const qShort =
        row.question.length > 42 ? `${row.question.slice(0, 39)}…` : row.question;
      const lab = document.createElementNS(svgNS, "text");
      lab.setAttribute("x", "6");
      lab.setAttribute("y", String(y + 4));
      lab.setAttribute("class", "ml-evals-viz__db-q");
      lab.textContent = qShort;
      gEl.appendChild(lab);

      const x1 = sx(row.lo);
      const x2 = sx(row.hi);
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", String(x1));
      line.setAttribute("x2", String(x2));
      line.setAttribute("y1", String(y));
      line.setAttribute("y2", String(y));
      line.setAttribute("class", "ml-evals-viz__db-line");
      gEl.appendChild(line);

      /** @param {'gpt'|'claude'|'deepseek'} key */
      function dot(key, score) {
        const [R, G, B] = MODEL_RGB[key];
        const c = document.createElementNS(svgNS, "circle");
        c.setAttribute("cx", String(sx(score) + pxNudge[key]));
        c.setAttribute("cy", String(y));
        c.setAttribute("r", "5");
        c.setAttribute("fill", `rgba(${R}, ${G}, ${B}, 0.9)`);
        c.setAttribute("stroke", "rgba(5, 5, 8, 0.75)");
        c.setAttribute("stroke-width", "0.9");
        gEl.appendChild(c);
      }
      dot("gpt", row.gpt);
      dot("claude", row.claude);
      dot("deepseek", row.deepseek);

      const spr = document.createElementNS(svgNS, "text");
      spr.setAttribute("x", String(plotRight + 6));
      spr.setAttribute("y", String(y + 4));
      spr.setAttribute("class", "ml-evals-viz__db-spread");
      spr.textContent = `Δ${row.spread.toFixed(1)}`;
      gEl.appendChild(spr);

      function tipHtml() {
        return (
          `<q>${esc(row.question)}</q>` +
          `<span class="ml-evals-viz__tip-line">ChatGPT stance: ${esc(row.gpt)} · Claude: ${esc(
            row.claude
          )} · DeepSeek: ${esc(row.deepseek)}</span>` +
          `<span class="ml-evals-viz__tip-line">Spread (max−min): ${esc(
            row.spread.toFixed(2)
          )} on the 1–5 rubric.</span>`
        );
      }

      gEl.addEventListener("mouseenter", (ev) => {
        tip.showTip(tipHtml(), ev.clientX, ev.clientY);
      });
      gEl.addEventListener("mousemove", (ev) => {
        tip.showTip(tipHtml(), ev.clientX, ev.clientY);
      });
      gEl.addEventListener("mouseleave", () => tip.hideTip());

      svg.appendChild(gEl);
    });

    const legY = 14;
    const models = ["gpt", "claude", "deepseek"];
    const labels = ["ChatGPT", "Claude", "DeepSeek"];
    let lx = plotLeft;
    models.forEach((mkey, j) => {
      const [R, G, B] = MODEL_RGB[mkey];
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", String(lx + 5));
      c.setAttribute("cy", String(legY));
      c.setAttribute("r", "4");
      c.setAttribute("fill", `rgba(${R}, ${G}, ${B}, 0.9)`);
      svg.appendChild(c);
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", String(lx + 14));
      t.setAttribute("y", String(legY + 4));
      t.setAttribute("class", "ml-evals-viz__db-legend");
      t.textContent = labels[j];
      svg.appendChild(t);
      lx += j === 0 ? 78 : 72;
    });

    const wrap = document.createElement("div");
    wrap.className = "ml-evals-viz__svg-wrap";
    wrap.appendChild(svg);
    panel.appendChild(wrap);
  }

  /**
   * @param {HTMLElement} panel
   * @param {{ pairIdx: number, question: string, g: Row, c: Row }[]} pairs
   * @param {{ showTip: (h: string, x: number, y: number) => void, hideTip: () => void }} tip
   */
  function renderGptClaudeOverlayPanel(panel, pairs, tip) {
    if (!pairs.length) return;

    const enriched = pairs
      .map((p) => {
        const ds = p.g.score - p.c.score;
        const dc = p.g.conf - p.c.conf;
        const absSt = Math.abs(ds);
        return { ...p, ds, dc, absSt };
      })
      .sort(
        (a, b) =>
          b.absSt - a.absSt || Math.abs(b.dc) - Math.abs(a.dc)
      )
      .slice(0, OVERLAY_GPT_CLAUDE_TOP_N);

    const [Rg, Gg, Bg] = MODEL_RGB.gpt;
    const [Rc, Gc, Bc] = MODEL_RGB.claude;

    const W = 560;
    const H = 460;
    const m = { l: 48, r: 22, t: 20, b: 56 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const xLo = AXIS_MIN - EDGE_PAD;
    const xHi = AXIS_MAX + EDGE_PAD;
    const yLo = AXIS_MIN - EDGE_PAD;
    const yHi = AXIS_MAX + EDGE_PAD;
    const sx = (v) => m.l + ((v - xLo) / (xHi - xLo)) * iw;
    const sy = (v) => m.t + ih - ((v - yLo) / (yHi - yLo)) * ih;

    const svgNS = "http://www.w3.org/2000/svg";
    const clipId = `ml-evals-og-${Math.random().toString(36).slice(2, 9)}`;
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.setAttribute("class", "ml-evals-viz__svg ml-evals-viz__svg--og");
    svg.setAttribute(
      "aria-label",
      "Overlaid ChatGPT and Claude stance versus confidence"
    );

    const defs = document.createElementNS(svgNS, "defs");
    const clipPath = document.createElementNS(svgNS, "clipPath");
    clipPath.setAttribute("id", clipId);
    const clipRect = document.createElementNS(svgNS, "rect");
    clipRect.setAttribute("x", String(m.l));
    clipRect.setAttribute("y", String(m.t));
    clipRect.setAttribute("width", String(iw));
    clipRect.setAttribute("height", String(ih));
    clipPath.appendChild(clipRect);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    const gGrid = document.createElementNS(svgNS, "g");
    for (let t = AXIS_MIN; t <= AXIS_MAX; t++) {
      const lx = sx(t);
      const v = document.createElementNS(svgNS, "line");
      v.setAttribute("x1", String(lx));
      v.setAttribute("x2", String(lx));
      v.setAttribute("y1", String(m.t));
      v.setAttribute("y2", String(m.t + ih));
      v.setAttribute("class", "ml-evals-viz__axis");
      gGrid.appendChild(v);
    }
    for (let t = AXIS_MIN; t <= AXIS_MAX; t++) {
      const ly = sy(t);
      const hln = document.createElementNS(svgNS, "line");
      hln.setAttribute("y1", String(ly));
      hln.setAttribute("y2", String(ly));
      hln.setAttribute("x1", String(m.l));
      hln.setAttribute("x2", String(m.l + iw));
      hln.setAttribute("class", "ml-evals-viz__axis");
      gGrid.appendChild(hln);
    }
    svg.appendChild(gGrid);

    const gPts = document.createElementNS(svgNS, "g");
    gPts.setAttribute("clip-path", `url(#${clipId})`);

    const PX = { gpt: -5.5, claude: 5.5 };

    /** @param {"gpt"|"claude"} which */
    function addDot(which, row, pairIdx) {
      const plotX = row.score;
      const plotY = row.conf;
      const cx = sx(plotX) + PX[which];
      const cy = sy(plotY);
      const c = document.createElementNS(svgNS, "circle");
      c.setAttribute("cx", String(cx));
      c.setAttribute("cy", String(cy));
      c.setAttribute("r", "4.5");
      c.setAttribute("data-pair", String(pairIdx));
      const cls =
        which === "gpt"
          ? "ml-evals-viz__pt ml-evals-viz__pt--og ml-evals-viz__pt--og-gpt"
          : "ml-evals-viz__pt ml-evals-viz__pt--og ml-evals-viz__pt--og-claude";
      c.setAttribute("class", cls);
      const [R, G, B] =
        which === "gpt" ? [Rg, Gg, Bg] : [Rc, Gc, Bc];
      const salt = which === "gpt" ? 1 : 4;
      const seed =
        pairIdx * 4999 +
        salt * 13 +
        row.score * 29 +
        row.conf * 19 +
        (R + G * 2 + B * 3);
      c.setAttribute("fill", perturbedModelFill(R, G, B, seed));
      c.setAttribute("tabindex", "0");

      const ansShort =
        row.answer.length > 220
          ? `${row.answer.slice(0, 217)}…`
          : row.answer;
      const label = which === "gpt" ? "ChatGPT" : "Claude";

      function tipHtml() {
        return (
          `<q>${esc(row.question)}</q>` +
          `<span class="ml-evals-viz__tip-line">${esc(label)} · #${esc(
            row.id
          )} · stance ${esc(row.score)} · confidence ${esc(row.conf)}</span>` +
          `<span class="ml-evals-viz__tip-line">${esc(ansShort)}</span>`
        );
      }

      c.addEventListener("mouseenter", (e) => {
        c.classList.add("ml-evals-viz__pt--hi");
        tip.showTip(tipHtml(), e.clientX, e.clientY);
      });
      c.addEventListener("mousemove", (e) => {
        tip.showTip(tipHtml(), e.clientX, e.clientY);
      });
      c.addEventListener("mouseleave", () => {
        c.classList.remove("ml-evals-viz__pt--hi");
        tip.hideTip();
      });
      c.addEventListener("focus", () => {
        c.classList.add("ml-evals-viz__pt--hi");
        const br = c.getBoundingClientRect();
        tip.showTip(tipHtml(), br.left + br.width / 2, br.top);
      });
      c.addEventListener("blur", () => {
        c.classList.remove("ml-evals-viz__pt--hi");
        tip.hideTip();
      });
      gPts.appendChild(c);
    }

    pairs.forEach((p) => {
      addDot("gpt", p.g, p.pairIdx);
      addDot("claude", p.c, p.pairIdx);
    });

    svg.appendChild(gPts);

    const linkLayer = document.createElementNS(svgNS, "g");
    linkLayer.setAttribute("class", "ml-evals-viz__og-link-layer");
    linkLayer.setAttribute("pointer-events", "none");
    svg.appendChild(linkLayer);

    const xl = document.createElementNS(svgNS, "text");
    xl.setAttribute("x", String(W / 2));
    xl.setAttribute("y", String(H - 36));
    xl.setAttribute("text-anchor", "middle");
    xl.setAttribute("class", "ml-evals-viz__lbl");
    xl.textContent = "Rubric stance: utilitarian ←————————→ deontological";
    svg.appendChild(xl);

    const xl2 = document.createElementNS(svgNS, "text");
    xl2.setAttribute("x", String(W / 2));
    xl2.setAttribute("y", String(H - 22));
    xl2.setAttribute("text-anchor", "middle");
    xl2.setAttribute("class", "ml-evals-viz__lbl");
    xl2.textContent =
      "(fixed 1–5; cyan = ChatGPT · violet = Claude)";
    svg.appendChild(xl2);

    const xl3 = document.createElementNS(svgNS, "text");
    xl3.setAttribute("x", String(W / 2));
    xl3.setAttribute("y", String(H - 8));
    xl3.setAttribute("text-anchor", "middle");
    xl3.setAttribute("class", "ml-evals-viz__lbl");
    xl3.textContent =
      "Same prompt: two dots nudged horizontally so overlapping scores stay readable.";
    svg.appendChild(xl3);

    const yl = document.createElementNS(svgNS, "text");
    yl.setAttribute("x", "12");
    yl.setAttribute("y", String(m.t + ih / 2));
    yl.setAttribute("text-anchor", "middle");
    yl.setAttribute("transform", `rotate(-90 12 ${m.t + ih / 2})`);
    yl.setAttribute("class", "ml-evals-viz__lbl");
    yl.textContent = "Confidence (1–5)";
    svg.appendChild(yl);

    const legY = 14;
    const legModels = [
      { key: "gpt", lab: "ChatGPT" },
      { key: "claude", lab: "Claude" },
    ];
    let lx = m.l;
    legModels.forEach(({ key, lab }, j) => {
      const [R, G, B] = MODEL_RGB[key];
      const dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("cx", String(lx + 5));
      dot.setAttribute("cy", String(legY));
      dot.setAttribute("r", "4");
      dot.setAttribute("fill", `rgba(${R}, ${G}, ${B}, 0.85)`);
      svg.appendChild(dot);
      const t = document.createElementNS(svgNS, "text");
      t.setAttribute("x", String(lx + 14));
      t.setAttribute("y", String(legY + 4));
      t.setAttribute("class", "ml-evals-viz__db-legend");
      t.textContent = lab;
      svg.appendChild(t);
      lx += j === 0 ? 88 : 92;
    });

    function clearOgHover() {
      linkLayer.innerHTML = "";
      svg.querySelectorAll(".ml-evals-viz__pt--og-hi").forEach((el) => {
        el.classList.remove("ml-evals-viz__pt--og-hi");
      });
    }

    function setOgHoverGcLink(pairIdxStr) {
      clearOgHover();
      svg
        .querySelectorAll(`circle.ml-evals-viz__pt--og[data-pair="${pairIdxStr}"]`)
        .forEach((el) => {
          el.classList.add("ml-evals-viz__pt--og-hi");
        });
      const a = svg.querySelector(
        `circle.ml-evals-viz__pt--og-gpt[data-pair="${pairIdxStr}"]`
      );
      const b = svg.querySelector(
        `circle.ml-evals-viz__pt--og-claude[data-pair="${pairIdxStr}"]`
      );
      if (!a || !b) return;
      const line = document.createElementNS(svgNS, "line");
      line.setAttribute("x1", a.getAttribute("cx") || "0");
      line.setAttribute("y1", a.getAttribute("cy") || "0");
      line.setAttribute("x2", b.getAttribute("cx") || "0");
      line.setAttribute("y2", b.getAttribute("cy") || "0");
      line.setAttribute("class", "ml-evals-viz__og-link");
      linkLayer.appendChild(line);
    }

    const chartWrap = document.createElement("div");
    chartWrap.className = "ml-evals-viz__svg-wrap ml-evals-viz__og-chart";
    chartWrap.appendChild(svg);

    const listEl = document.createElement("div");
    listEl.className = "ml-evals-viz__og-list";
    listEl.setAttribute("role", "list");

    function fmtSigned(v) {
      const sign = v >= 0 ? "+" : "";
      return `${sign}${v.toFixed(1)}`;
    }

    enriched.forEach((row) => {
      const rowEl = document.createElement("div");
      rowEl.className = "ml-evals-viz__og-row";
      rowEl.setAttribute("role", "listitem");
      rowEl.setAttribute("data-pair", String(row.pairIdx));
      rowEl.setAttribute("tabindex", "0");

      const meta = document.createElement("span");
      meta.className = "ml-evals-viz__og-row-meta";
      meta.textContent = `|Δs| ${row.absSt.toFixed(1)} · stance ${fmtSigned(
        row.ds
      )} (G−C) · conf ${fmtSigned(row.dc)}`;

      const qEl = document.createElement("span");
      qEl.className = "ml-evals-viz__og-row-q";
      qEl.textContent = row.question;
      qEl.style.cursor = "help";

      rowEl.appendChild(meta);
      rowEl.appendChild(qEl);

      const pk = String(row.pairIdx);
      rowEl.addEventListener("mouseenter", () => setOgHoverGcLink(pk));
      rowEl.addEventListener("mouseleave", () => {
        clearOgHover();
        clearOgAnsPops();
      });
      rowEl.addEventListener("focus", () => setOgHoverGcLink(pk));
      rowEl.addEventListener("blur", () => {
        clearOgHover();
        clearOgAnsPops();
      });
      qEl.addEventListener("mouseenter", () =>
        showOgAnsPopsNearDots(svg, pk, row.g, row.c)
      );
      qEl.addEventListener("mouseleave", clearOgAnsPops);

      listEl.appendChild(rowEl);
    });

    const layout = document.createElement("div");
    layout.className = "ml-evals-viz__og-layout";
    layout.appendChild(chartWrap);
    layout.appendChild(listEl);

    panel.appendChild(layout);
  }

  function mount() {
    const root = document.getElementById(rootId);
    if (!root) return;

    const scriptEl = document.currentScript;
    const baseUrl =
      scriptEl && "src" in scriptEl && scriptEl.src
        ? new URL(".", scriptEl.src).href
        : "";

    root.innerHTML = "";
    root.classList.add("ml-evals-viz");

    const style = document.createElement("style");
    style.textContent = `
      .ml-evals-viz { margin: 1.25rem 0; display: flex; flex-direction: column; gap: 1.5rem; }
      .ml-evals-viz__panel {
        border: 1px solid rgba(0, 240, 255, 0.22);
        border-radius: 2px;
        padding: 14px 14px 10px;
        background: rgba(0, 240, 255, 0.045);
      }
      .ml-evals-viz__panel--claude {
        border-color: rgba(196, 167, 255, 0.28);
        background: rgba(196, 167, 255, 0.06);
      }
      .ml-evals-viz__panel--deepseek {
        border-color: rgba(120, 185, 255, 0.32);
        background: rgba(120, 185, 255, 0.06);
      }
      .ml-evals-viz__title { font-weight: 600; margin: 0 0 6px; font-size: 0.95rem; }
      .ml-evals-viz__blurb {
        margin: 0 0 12px;
        font-size: 0.82rem;
        color: rgba(232, 240, 255, 0.72);
        line-height: 1.45;
      }
      .ml-evals-viz__svg-wrap { width: 100%; overflow-x: auto; }
      .ml-evals-viz__svg { display: block; width: 100%; max-width: 560px; height: auto; margin: 0 auto; }
      .ml-evals-viz__axis { stroke: rgba(232, 240, 255, 0.14); stroke-width: 1; }
      .ml-evals-viz__lbl { fill: rgba(232, 240, 255, 0.55); font-size: 9.5px; font-family: var(--font, ui-monospace, monospace); }
      .ml-evals-viz__pt { cursor: pointer; stroke: rgba(5, 5, 8, 0.9); stroke-width: 1.1; }
      .ml-evals-viz__pt--hi { filter: drop-shadow(0 0 6px rgba(0, 240, 255, 0.65)); }
      .ml-evals-viz__pt--claude.ml-evals-viz__pt--hi { filter: drop-shadow(0 0 6px rgba(196, 167, 255, 0.7)); }
      .ml-evals-viz__pt--deepseek.ml-evals-viz__pt--hi { filter: drop-shadow(0 0 6px rgba(120, 185, 255, 0.72)); }
      .ml-evals-viz__svg--og .ml-evals-viz__pt { stroke: none; }
      .ml-evals-viz__tip {
        position: fixed; z-index: 50; max-width: min(420px, 92vw);
        padding: 10px 11px; font-size: 0.78rem; line-height: 1.45;
        color: #e8f0ff; background: rgba(11, 13, 18, 0.96);
        border: 1px solid rgba(0, 240, 255, 0.28); border-radius: 2px;
        pointer-events: none; opacity: 0; transition: opacity 0.12s;
        box-shadow: 0 8px 28px rgba(0,0,0,0.45);
      }
      .ml-evals-viz__tip--on { opacity: 1; }
      .ml-evals-viz__tip q { display: block; margin: 0 0 8px; color: rgba(232, 240, 255, 0.92); font-style: italic; }
      .ml-evals-viz__tip .ml-evals-viz__tip-line { display: block; font-size: 0.72rem; color: rgba(139, 152, 179, 0.95); margin-top: 6px; }
      .ml-evals-viz__err { color: #ff9db4; font-size: 0.82rem; margin: 0 0 8px; }
      .ml-evals-viz__panel--dumbbell {
        border-color: rgba(160, 210, 255, 0.28);
        background: rgba(0, 240, 255, 0.03);
      }
      .ml-evals-viz__db-line {
        stroke: rgba(232, 240, 255, 0.35);
        stroke-width: 2;
        stroke-linecap: round;
      }
      .ml-evals-viz__db-q {
        fill: rgba(232, 240, 255, 0.88);
        font-size: 8.5px;
        font-family: var(--font, ui-monospace, monospace);
      }
      .ml-evals-viz__db-row:hover .ml-evals-viz__db-q { fill: #e8f0ff; }
      .ml-evals-viz__db-spread {
        fill: rgba(139, 152, 179, 0.95);
        font-size: 8px;
        font-family: var(--font, ui-monospace, monospace);
      }
      .ml-evals-viz__db-tick {
        fill: rgba(232, 240, 255, 0.45);
        font-size: 8px;
        font-family: var(--font, ui-monospace, monospace);
      }
      .ml-evals-viz__db-legend {
        fill: rgba(232, 240, 255, 0.65);
        font-size: 8.5px;
        font-family: var(--font, ui-monospace, monospace);
      }
      .ml-evals-viz__panel--og {
        border-color: rgba(140, 200, 255, 0.3);
        background: linear-gradient(
          135deg,
          rgba(0, 240, 255, 0.04) 0%,
          rgba(120, 185, 255, 0.06) 100%
        );
        width: min(72rem, calc(100vw - 2rem));
        max-width: none;
        position: relative;
        left: 50%;
        transform: translateX(-50%);
        box-sizing: border-box;
      }
      .ml-evals-viz__og-layout {
        display: flex;
        flex-direction: column;
        gap: 16px;
        align-items: stretch;
      }
      .ml-evals-viz__og-chart {
        width: min(720px, 100%);
        max-width: 100%;
        margin-inline: auto;
        flex-shrink: 0;
      }
      .ml-evals-viz__og-chart .ml-evals-viz__svg {
        display: block;
        width: 100%;
        max-width: 720px;
        height: auto;
        margin: 0;
      }
      @media (min-width: 1024px) {
        .ml-evals-viz__og-layout {
          display: grid;
          grid-template-columns: min(720px, 100%) minmax(260px, 1fr);
          gap: 22px;
          align-items: start;
        }
        .ml-evals-viz__og-chart {
          margin-inline: 0;
        }
        .ml-evals-viz__og-list {
          border-left: 1px solid rgba(160, 210, 255, 0.22);
          padding-left: 14px;
        }
      }
      .ml-evals-viz__og-list {
        max-height: min(480px, 58vh);
        overflow-y: auto;
        font-size: 0.82rem;
        line-height: 1.4;
        color: rgba(232, 240, 255, 0.88);
      }
      .ml-evals-viz__og-row {
        padding: 6px 8px;
        margin-bottom: 4px;
        border-radius: 2px;
        cursor: default;
        outline: none;
      }
      .ml-evals-viz__og-row:hover,
      .ml-evals-viz__og-row:focus-visible {
        background: rgba(0, 240, 255, 0.08);
      }
      .ml-evals-viz__og-row-meta {
        display: block;
        font-family: var(--font, ui-monospace, monospace);
        font-size: 0.74rem;
        color: rgba(139, 152, 179, 0.95);
        margin-bottom: 2px;
      }
      .ml-evals-viz__og-row-q {
        display: block;
        color: rgba(232, 240, 255, 0.9);
        white-space: normal;
        overflow-wrap: anywhere;
        word-break: break-word;
        line-height: 1.42;
      }
      .ml-evals-viz__og-link {
        stroke: rgba(255, 255, 255, 0.62);
        stroke-width: 2.1;
        stroke-linecap: round;
      }
      .ml-evals-viz__pt--og-gpt.ml-evals-viz__pt--og-hi {
        filter: drop-shadow(0 0 7px rgba(0, 240, 255, 0.75));
      }
      .ml-evals-viz__pt--og-claude.ml-evals-viz__pt--og-hi {
        filter: drop-shadow(0 0 7px rgba(196, 167, 255, 0.78));
      }
      .ml-evals-viz__og-ans-pop {
        position: fixed;
        z-index: 48;
        max-width: min(280px, 42vw);
        max-height: min(220px, 38vh);
        overflow-y: auto;
        overflow-x: hidden;
        padding: 8px 10px 10px;
        font-size: 0.72rem;
        line-height: 1.38;
        color: rgba(232, 240, 255, 0.94);
        background: rgba(12, 14, 20, 0.97);
        border: 1px solid rgba(160, 210, 255, 0.32);
        border-radius: 2px;
        box-shadow: 0 8px 26px rgba(0, 0, 0, 0.5);
        pointer-events: none;
      }
      .ml-evals-viz__og-ans-pop-lab {
        font-weight: 600;
        font-size: 0.68rem;
        margin-bottom: 5px;
        letter-spacing: 0.02em;
      }
      .ml-evals-viz__og-ans-pop--gpt .ml-evals-viz__og-ans-pop-lab {
        color: rgba(0, 240, 255, 0.95);
      }
      .ml-evals-viz__og-ans-pop--claude .ml-evals-viz__og-ans-pop-lab {
        color: rgba(196, 167, 255, 0.95);
      }
      .ml-evals-viz__og-ans-pop-body {
        color: rgba(200, 210, 230, 0.92);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
    `;
    root.appendChild(style);

    const tipEl = document.createElement("div");
    tipEl.className = "ml-evals-viz__tip";
    tipEl.setAttribute("role", "tooltip");
    document.body.appendChild(tipEl);

    function showTip(html, clientX, clientY) {
      tipEl.innerHTML = html;
      tipEl.classList.add("ml-evals-viz__tip--on");
      const pad = 14;
      const rect = tipEl.getBoundingClientRect();
      let x = clientX + pad;
      let y = clientY + pad;
      if (x + rect.width > window.innerWidth - 8) x = clientX - rect.width - pad;
      if (y + rect.height > window.innerHeight - 8) y = clientY - rect.height - pad;
      tipEl.style.left = `${Math.max(8, x)}px`;
      tipEl.style.top = `${Math.max(8, y)}px`;
    }

    function hideTip() {
      tipEl.classList.remove("ml-evals-viz__tip--on");
    }

    function hideTipAndOgAnsPops() {
      hideTip();
      clearOgAnsPops();
    }
    document.addEventListener("scroll", hideTipAndOgAnsPops, true);

    const tipApi = { showTip, hideTip };

    CHARTS.forEach((spec, chartIdx) => {
      const panel = document.createElement("div");
      panel.className = `ml-evals-viz__panel ${spec.panelClass}`.trim();

      const title = document.createElement("div");
      title.className = "ml-evals-viz__title";
      title.textContent = spec.title;

      const blurb = document.createElement("p");
      blurb.className = "ml-evals-viz__blurb";
      blurb.textContent = spec.blurb;

      const err = document.createElement("p");
      err.className = "ml-evals-viz__err";
      err.style.display = "none";

      panel.appendChild(title);
      panel.appendChild(blurb);
      panel.appendChild(err);
      root.appendChild(panel);

      const clipId = `ml-evals-clip-${chartIdx}-${Math.random().toString(36).slice(2, 9)}`;

      const url = baseUrl ? new URL(spec.file, baseUrl).href : spec.file;
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then((text) => {
          const rows = tableToObjects(parseCsv(text));
          if (!rows.length) throw new Error("No rows parsed");
          renderPlane(panel, rows, tipApi, spec, clipId);
        })
        .catch((e) => {
          err.style.display = "block";
          err.textContent = `Could not load ${spec.file}: ${e.message}`;
        });
    });

    const dbPanel = document.createElement("div");
    dbPanel.className = "ml-evals-viz__panel ml-evals-viz__panel--dumbbell";
    const dbTitle = document.createElement("div");
    dbTitle.className = "ml-evals-viz__title";
    dbTitle.textContent = "Stance spread across models (dumbbell)";
    const dbBlurb = document.createElement("p");
    dbBlurb.className = "ml-evals-viz__blurb";
    dbBlurb.textContent =
      `For each prompt, the gray segment runs from the lowest to the highest utilitarian→deontological stance among the three models (same 1–5 scale as above). ` +
      `Dots are ChatGPT (cyan), Claude (violet), DeepSeek (blue). Showing the ${DUMBBELL_TOP_N} prompts with the largest spread (max − min).`;
    const dbErr = document.createElement("p");
    dbErr.className = "ml-evals-viz__err";
    dbErr.style.display = "none";
    dbPanel.appendChild(dbTitle);
    dbPanel.appendChild(dbBlurb);
    dbPanel.appendChild(dbErr);
    root.appendChild(dbPanel);

    const ogPanel = document.createElement("div");
    ogPanel.className = "ml-evals-viz__panel ml-evals-viz__panel--og";
    const ogTitle = document.createElement("div");
    ogTitle.className = "ml-evals-viz__title";
    ogTitle.textContent = "ChatGPT vs Claude — overlaid score plane";
    const ogBlurb = document.createElement("p");
    ogBlurb.className = "ml-evals-viz__blurb";
    ogBlurb.textContent =
      `Same 1–5 × 1–5 grid: both models on one plot (cyan and violet). ` +
      `The list ranks prompts by the largest absolute stance gap |ChatGPT − Claude| on the rubric (signed deltas shown; confidence gap as tiebreak). ` +
      `Hover a list row to link the two dots; hover the question text for answer popups near each dot.`;
    const ogErr = document.createElement("p");
    ogErr.className = "ml-evals-viz__err";
    ogErr.style.display = "none";
    ogPanel.appendChild(ogTitle);
    ogPanel.appendChild(ogBlurb);
    ogPanel.appendChild(ogErr);
    root.appendChild(ogPanel);

    const uG = baseUrl ? new URL(FILE_GPT, baseUrl).href : FILE_GPT;
    const uC = baseUrl ? new URL(FILE_CLAUDE, baseUrl).href : FILE_CLAUDE;
    const uD = baseUrl ? new URL(FILE_DEEPSEEK, baseUrl).href : FILE_DEEPSEEK;
    Promise.all([
      fetch(uG).then((r) => {
        if (!r.ok) throw new Error(`ChatGPT HTTP ${r.status}`);
        return r.text();
      }),
      fetch(uC).then((r) => {
        if (!r.ok) throw new Error(`Claude HTTP ${r.status}`);
        return r.text();
      }),
      fetch(uD).then((r) => {
        if (!r.ok) throw new Error(`DeepSeek HTTP ${r.status}`);
        return r.text();
      }),
    ])
      .then(([tg, tc, td]) => {
        const gRows = tableToObjects(parseCsv(tg));
        const cRows = tableToObjects(parseCsv(tc));
        const dRows = tableToObjects(parseCsv(td));
        if (!gRows.length || !cRows.length || !dRows.length) {
          throw new Error("Missing model data");
        }
        const tripleRows = alignTripleRows(gRows, cRows, dRows);
        if (!tripleRows.length) {
          dbErr.style.display = "block";
          dbErr.textContent =
            "Dumbbell chart: could not align questions across the three CSVs.";
        } else {
          const triples = tripleRows.map((t) => ({
            question: t.question,
            gpt: t.g.score,
            claude: t.c.score,
            deepseek: t.d.score,
          }));
          renderDumbbellChart(dbPanel, triples, tipApi);
        }

        const gcRows = alignGptClaudeRows(gRows, cRows);
        if (!gcRows.length) {
          ogErr.style.display = "block";
          ogErr.textContent =
            "ChatGPT vs Claude overlay: could not align the two CSVs by question.";
        } else {
          renderGptClaudeOverlayPanel(ogPanel, gcRows, tipApi);
        }
      })
      .catch((e) => {
        dbErr.style.display = "block";
        dbErr.textContent = `Dumbbell chart: ${e.message}`;
        ogErr.style.display = "block";
        ogErr.textContent = `ChatGPT vs Claude overlay: ${e.message}`;
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
