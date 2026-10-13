/* APS Review: a static study app.
   Content lives in /data (manifest.json, Markdown pages, JSON tests).
   Notes and scores are saved in this browser (localStorage). */
(() => {
  "use strict";

  const main = document.getElementById("main");
  const navEl = document.getElementById("nav");
  const sidebar = document.getElementById("sidebar");
  const scrim = document.querySelector(".scrim");
  const menuBtn = document.querySelector(".menu-btn");
  const LETTERS = ["A", "B", "C", "D"];

  let manifest = null;
  const SHEET_URL = (window.APS_CONFIG && window.APS_CONFIG.sheetUrl) || "";

  /* Pull notes from the Google Sheet (if configured) into local storage. */
  async function loadSheetNotes() {
    if (!SHEET_URL) return;
    try {
      const res = await fetch(SHEET_URL);
      const notes = await res.json();
      Object.entries(notes).forEach(([id, text]) => store.set("note:" + id, text));
    } catch (e) { console.warn("Google Sheet not reachable, using notes on this device.", e); }
  }
  function refreshNotesFromSheet() {
    const ta = document.getElementById("note");
    const m = location.hash.match(/^#\/c\/([^/?#]+)/);
    if (ta && m && document.activeElement !== ta) ta.value = note(decodeURIComponent(m[1]));
    else if (!location.hash || location.hash === "#/") viewHome();
  }
  function saveToSheet(course, text) {
    return fetch(SHEET_URL, { method: "POST", mode: "no-cors", body: JSON.stringify({ id: course.id, course: course.title, note: text }) });
  }
  const cache = new Map();

  /* ---------- Storage ---------- */
  const store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem("aps:" + key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem("aps:" + key, JSON.stringify(value)); return true; }
      catch (e) { return false; }
    }
  };
  const best = (testId) => store.get("best:" + testId, null);
  const note = (courseId) => store.get("note:" + courseId, "");

  /* ---------- Fetching ---------- */
  async function load(path, asText) {
    if (cache.has(path)) return cache.get(path);
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error(`Could not load ${path} (HTTP ${res.status}).`);
    const data = asText ? await res.text() : await res.json();
    cache.set(path, data);
    return data;
  }

  /* ---------- Helpers ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inline = (s) => (window.marked ? marked.parseInline(String(s)) : esc(s));
  const courseById = (id) => manifest.courses.find((c) => c.id === id);
  const testById = (id) => manifest.tests.find((t) => t.id === id);
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  function setTitle(t) { document.title = t ? `${t} · APS Review` : "APS Review · Multimedia Graphic Design"; }
  function scoreLabel(test) {
    const b = best(test.id);
    return b ? `${b.score}/${b.total}` : "Not taken";
  }
  function passed(test) {
    const b = best(test.id);
    return !!b && b.score >= test.target;
  }
  function focusMain() { main.focus({ preventScroll: true }); window.scrollTo(0, 0); }

  /* ---------- Mobile nav ---------- */
  function openNav(open) {
    sidebar.classList.toggle("open", open);
    scrim.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
  }
  menuBtn.addEventListener("click", () => openNav(!sidebar.classList.contains("open")));
  scrim.addEventListener("click", () => openNav(false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") openNav(false); });

  /* ---------- Navigation ---------- */
  function renderNav() {
    const groups = [];
    const byGroup = {};
    manifest.courses.forEach((c) => {
      if (!byGroup[c.group]) { byGroup[c.group] = []; groups.push(c.group); }
      byGroup[c.group].push(c);
    });
    const link = (href, label, meta, pass) =>
      `<li><a class="nav-link" href="${href}"><span>${esc(label)}</span>${meta ? `<span class="nav-meta${pass ? " pass" : ""}">${esc(meta)}</span>` : ""}</a></li>`;

    let html = `<section class="nav-group"><h2>Start here</h2><ul>`;
    html += link("#/", "Readiness board");
    manifest.pages.forEach((p) => { html += link(`#/p/${p.id}`, p.title); });
    html += `</ul></section>`;
    groups.forEach((g) => {
      html += `<section class="nav-group"><h2>${esc(g)}</h2><ul>`;
      byGroup[g].forEach((c) => {
        const t = c.test ? testById(c.test) : null;
        const b = t ? best(t.id) : null;
        html += link(`#/c/${c.id}`, c.title, b ? `${b.score}/${b.total}` : "", t && passed(t));
      });
      html += `</ul></section>`;
    });
    const mixed = manifest.tests.filter((t) => !t.course);
    if (mixed.length) {
      html += `<section class="nav-group"><h2>Practice</h2><ul>`;
      mixed.forEach((t) => { const b = best(t.id); html += link(`#/t/${t.id}`, t.title + " test", b ? `${b.score}/${b.total}` : "", passed(t)); });
      html += `</ul></section>`;
    }
    navEl.innerHTML = html;
    markCurrent();
  }
  function markCurrent() {
    const hash = location.hash || "#/";
    navEl.querySelectorAll(".nav-link").forEach((a) => {
      const href = a.getAttribute("href");
      let current = href === hash;
      if (!current && hash.startsWith("#/t/")) {
        const t = testById(hash.slice(4));
        if (t && t.course && href === `#/c/${t.course}`) current = true;
      }
      if (current) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
  }

  /* ---------- Markdown + mind maps ---------- */
  let mermaidReady = false;
  function initMermaid() {
    if (mermaidReady || !window.mermaid) return;
    mermaid.initialize({
      startOnLoad: false,
      theme: "neutral",
      fontFamily: getComputedStyle(document.body).fontFamily,
      mindmap: { padding: 12 }
    });
    mermaidReady = true;
  }
  async function renderMarkdown(md, into) {
    into.innerHTML = window.marked ? marked.parse(md) : `<pre>${esc(md)}</pre>`;
    into.querySelectorAll("table").forEach((t) => {
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      t.replaceWith(wrap);
      wrap.appendChild(t);
    });
    // Mind maps stay as a button; the 3 MB library loads only when tapped.
    into.querySelectorAll("pre > code.language-mermaid").forEach((code) => {
      const src = code.textContent;
      const slot = document.createElement("div");
      slot.className = "mindmap-slot";
      slot.innerHTML = `<button type="button" class="btn btn--quiet">Show mind map</button>`;
      code.parentElement.replaceWith(slot);
      const btn = slot.querySelector("button");
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Loading mind map…";
        try {
          await loadMermaid();
          const div = document.createElement("div");
          div.className = "mindmap mermaid";
          div.textContent = src;
          slot.replaceWith(div);
          await mermaid.run({ nodes: [div] });
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "Mind map could not load. Tap to try again";
        }
      });
    });
  }
  const MERMAID_SRC = "https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js";
  let mermaidPromise = null;
  function loadMermaid() {
    if (window.mermaid) { initMermaid(); return Promise.resolve(); }
    if (!mermaidPromise) {
      mermaidPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = MERMAID_SRC;
        s.onload = () => { initMermaid(); resolve(); };
        s.onerror = () => { mermaidPromise = null; s.remove(); reject(new Error("Mind map library failed to load")); };
        document.head.appendChild(s);
      });
    }
    return mermaidPromise;
  }

  /* ---------- Views ---------- */
  function viewHome() {
    setTitle("");
    const tests = manifest.tests.filter((t) => t.course);
    const done = tests.filter(passed).length;
    const groups = [];
    const byGroup = {};
    manifest.courses.forEach((c) => {
      if (!byGroup[c.group]) { byGroup[c.group] = []; groups.push(c.group); }
      byGroup[c.group].push(c);
    });

    let html = `
      <h1 class="page-title">Readiness board</h1>
      <p class="lede">Study a course, write what you did in it, then take its test until you reach the pass mark.</p>
      <div class="readiness frame"><span class="corners"></span>
        <div class="big">${done}<span> / ${tests.length}</span></div>
        <p>course tests passed</p>
      </div>`;
    groups.forEach((g) => {
      html += `<section class="board"><h2>${esc(g)}</h2><ul>`;
      byGroup[g].forEach((c) => {
        const t = c.test ? testById(c.test) : null;
        const b = t ? best(t.id) : null;
        const pct = b ? Math.round((b.score / b.total) * 100) : 0;
        const hasNote = note(c.id).trim().length > 0;
        const parts = [];
        if (t) parts.push(b ? `Best ${b.score}/${b.total}, pass mark ${t.target}` : `Test not taken, pass mark ${t.target}`);
        else parts.push("No quiz: practise with the interview questions");
        parts.push(hasNote ? "Notes written" : "No notes yet");
        html += `<li>
          <a class="course" href="#/c/${c.id}">${esc(c.title)}</a>
          <span class="grade">${c.grade ? `Grade ${esc(c.grade)}` : ""}</span>
          ${t ? `<div class="meter" aria-hidden="true"><i class="${passed(t) ? "pass" : ""}" style="width:${pct}%"></i></div>` : ""}
          <span class="status">${esc(parts.join(". "))}.</span>
        </li>`;
      });
      html += `</ul></section>`;
    });
    main.innerHTML = html;
  }

  async function viewPage(id) {
    const p = manifest.pages.find((x) => x.id === id);
    if (!p) return viewMissing();
    setTitle(p.title);
    main.innerHTML = `<h1 class="page-title">${esc(p.title)}</h1><div class="prose" id="md"></div>`;
    const md = await load(p.file, true);
    await renderMarkdown(md, document.getElementById("md"));
  }

  async function viewCourse(id) {
    const c = courseById(id);
    if (!c) return viewMissing();
    setTitle(c.title);
    const t = c.test ? testById(c.test) : null;
    const meta = [c.group];
    if (c.credits) meta.push(`${c.credits} credit${c.credits > 1 ? "s" : ""}`);
    if (c.grade) meta.push(`grade ${c.grade}${c.score ? ` (${c.score})` : ""}`);

    main.innerHTML = `
      <h1 class="page-title">${esc(c.title)}</h1>
      <p class="course-meta">${esc(meta.join(", "))}</p>
      ${t ? `<div class="test-call">
          <p>${t.count}-question test, pass mark ${t.target}. ${best(t.id) ? `Your best: <strong>${scoreLabel(t)}</strong>.` : "Not taken yet."}</p>
          <a class="btn" href="#/t/${t.id}">Start the test</a>
        </div>` : ""}
      <div class="notes">
        <label for="note">What I did</label>
        <textarea id="note" placeholder="${esc(c.noteHint || "What you made in this course, your role, tools and result")}"></textarea>
        <p class="fine" id="note-status" aria-live="polite">${SHEET_URL ? "Saves to your Google Sheet as you type." : "Saved on this device as you type."}</p>
      </div>
      <div class="prose" id="md"></div>`;

    const ta = document.getElementById("note");
    const status = document.getElementById("note-status");
    ta.value = note(c.id);
    let timer;
    ta.addEventListener("input", () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        store.set("note:" + c.id, ta.value);
        if (!SHEET_URL) { status.textContent = "Saved on this device."; return; }
        status.textContent = "Saving to your Google Sheet…";
        saveToSheet(c, ta.value)
          .then(() => { status.textContent = "Saved to your Google Sheet."; })
          .catch(() => { status.textContent = "Saved on this device only. The sheet could not be reached."; });
      }, 400);
    });

    const md = await load(c.file, true);
    await renderMarkdown(md, document.getElementById("md"));
  }

  /* ---------- Quiz ---------- */
  async function viewTest(id) {
    const meta = testById(id);
    if (!meta) return viewMissing();
    setTitle(meta.title + " test");
    const data = await load(meta.file, false);
    const course = meta.course ? courseById(meta.course) : null;
    const prefs = store.get("prefs", { shuffleQ: false, shuffleA: true });

    main.innerHTML = `
      <h1 class="page-title">${esc(meta.title)} test</h1>
      <p class="lede">${data.questions.length} questions. Pass mark ${data.target}. ${best(id) ? `Your best so far is ${scoreLabel(meta)}.` : "You have not taken this test yet."}</p>
      <div class="quiz-card frame"><span class="corners"></span>
        <p>Pick an answer to see right away whether it is correct. Your best full-test score is saved on this device.</p>
        <div class="toggles">
          <label><input type="checkbox" id="sq" ${prefs.shuffleQ ? "checked" : ""}> Shuffle question order</label>
          <label><input type="checkbox" id="sa" ${prefs.shuffleA ? "checked" : ""}> Shuffle answer order</label>
        </div>
        <div class="actions">
          <button class="btn" id="start" type="button">Start the test</button>
          ${course ? `<a class="btn btn--quiet" href="#/c/${course.id}">Study ${esc(course.title)} first</a>` : ""}
        </div>
      </div>
      ${historyHtml(id)}`;

    document.getElementById("start").addEventListener("click", () => {
      const p = { shuffleQ: document.getElementById("sq").checked, shuffleA: document.getElementById("sa").checked };
      store.set("prefs", p);
      runQuiz(meta, data, data.questions.map((_, i) => i), p, true);
    });
  }

  function historyHtml(id) {
    const h = store.get("hist:" + id, []);
    if (!h.length) return "";
    const rows = h.slice(-5).reverse().map((r) => `${new Date(r.at).toLocaleDateString()}: ${r.score}/${r.total}`);
    return `<p class="history">Recent full attempts: ${esc(rows.join(", "))}.</p>`;
  }

  function runQuiz(meta, data, indices, prefs, isFull) {
    const order = prefs.shuffleQ ? shuffle(indices) : indices.slice();
    const run = order.map((qi) => {
      const q = data.questions[qi];
      const optOrder = prefs.shuffleA ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3];
      return { qi, q, optOrder, picked: null };
    });
    let pos = 0;
    let correct = 0;

    function draw() {
      const item = run[pos];
      const total = run.length;
      main.innerHTML = `
        <h1 class="page-title">${esc(meta.title)} test</h1>
        <p class="lede">${isFull ? "Full test" : `Retry of ${total} missed question${total > 1 ? "s" : ""}`}. Keys 1 to 4 pick an answer, Enter moves on.</p>
        <div class="quiz-card frame"><span class="corners"></span>
          <div class="progress" aria-hidden="true"><i style="width:${(pos / total) * 100}%"></i></div>
          <div class="hud"><span>Question <strong>${pos + 1}</strong> of ${total}</span><span>Correct so far <strong>${correct}</strong></span></div>
          <p class="q-text" id="qtext">${inline(item.q.q)}</p>
          <ul class="options" role="list" aria-labelledby="qtext">
            ${item.optOrder.map((oi, k) => `<li><button class="opt" type="button" data-oi="${oi}">
              <span class="letter">${LETTERS[k]}</span><span>${inline(item.q.options[oi])}</span></button></li>`).join("")}
          </ul>
          <p class="feedback" id="fb" aria-live="polite"></p>
          <div class="actions"><button class="btn" id="next" type="button" disabled>${pos + 1 === total ? "See my result" : "Next question"}</button></div>
        </div>`;
      main.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => pick(Number(b.dataset.oi))));
      document.getElementById("next").addEventListener("click", next);
    }

    function pick(oi) {
      const item = run[pos];
      if (item.picked !== null) return;
      item.picked = oi;
      const ok = oi === item.q.answer;
      if (ok) correct++;
      main.querySelectorAll(".opt").forEach((b) => {
        const v = Number(b.dataset.oi);
        b.disabled = true;
        if (v === item.q.answer) b.classList.add("correct");
        else if (v === oi) b.classList.add("wrong");
      });
      const fb = document.getElementById("fb");
      const k = item.optOrder.indexOf(item.q.answer);
      fb.className = "feedback " + (ok ? "good" : "bad");
      fb.innerHTML = ok ? "Correct." : `Not quite. The answer is ${LETTERS[k]}: ${inline(item.q.options[item.q.answer])}`;
      main.querySelector(".hud span:last-child strong").textContent = correct;
      const nb = document.getElementById("next");
      nb.disabled = false;
      nb.focus();
    }

    function next() {
      if (run[pos].picked === null) return;
      if (pos + 1 < run.length) { pos++; draw(); focusMain(); }
      else finish();
    }

    function finish() {
      document.removeEventListener("keydown", onKey);
      const total = run.length;
      const missed = run.filter((r) => r.picked !== r.q.answer);
      if (isFull) {
        const prev = best(meta.id);
        if (!prev || correct > prev.score) store.set("best:" + meta.id, { score: correct, total, at: Date.now() });
        const h = store.get("hist:" + meta.id, []);
        h.push({ score: correct, total, at: Date.now() });
        store.set("hist:" + meta.id, h.slice(-20));
        renderNav();
      }
      const target = isFull ? data.target : total;
      const ok = correct >= target;
      const course = meta.course ? courseById(meta.course) : null;
      main.innerHTML = `
        <h1 class="page-title">${esc(meta.title)} test</h1>
        <div class="quiz-card frame"><span class="corners"></span>
          <p class="score-big">${correct}<span> / ${total}</span></p>
          <p class="verdict ${ok ? "good" : "bad"}">${isFull
            ? (ok ? `Passed. The pass mark is ${data.target}.` : `Not yet. The pass mark is ${data.target}.`)
            : (ok ? "All missed questions now correct." : "Some are still wrong. Try them once more.")}</p>
          <div class="actions">
            ${missed.length ? `<button class="btn" id="retry-missed" type="button">Retry the ${missed.length} missed</button>` : ""}
            <button class="btn ${missed.length ? "btn--quiet" : ""}" id="retake" type="button">Take the full test again</button>
            ${course ? `<a class="btn btn--quiet" href="#/c/${course.id}">Back to ${esc(course.title)}</a>` : `<a class="btn btn--quiet" href="#/">Back to the board</a>`}
          </div>
        </div>
        ${missed.length ? `<h2>What you missed</h2><ul class="missed">${missed.map((r) => {
          const yk = r.optOrder.indexOf(r.picked), rk = r.optOrder.indexOf(r.q.answer);
          return `<li><p class="q">${inline(r.q.q)}</p>
            <p class="yours">You chose ${LETTERS[yk]}: ${inline(r.q.options[r.picked])}</p>
            <p class="right">Correct is ${LETTERS[rk]}: ${inline(r.q.options[r.q.answer])}</p></li>`;
        }).join("")}</ul>` : ""}`;
      const rm = document.getElementById("retry-missed");
      if (rm) rm.addEventListener("click", () => runQuiz(meta, data, missed.map((r) => r.qi), prefs, false));
      document.getElementById("retake").addEventListener("click", () => runQuiz(meta, data, data.questions.map((_, i) => i), prefs, true));
      focusMain();
    }

    function onKey(e) {
      if (!document.getElementById("next")) return;
      if (e.target && /TEXTAREA|INPUT/.test(e.target.tagName)) return;
      const n = ["1", "2", "3", "4"].indexOf(e.key);
      const l = ["a", "b", "c", "d"].indexOf(e.key.toLowerCase());
      const k = n >= 0 ? n : l;
      if (k >= 0 && run[pos].picked === null) { pick(run[pos].optOrder[k]); e.preventDefault(); }
      else if (e.key === "Enter" && run[pos].picked !== null) { next(); e.preventDefault(); }
    }
    document.addEventListener("keydown", onKey);
    stopQuiz = () => document.removeEventListener("keydown", onKey);
    draw();
    focusMain();
  }
  let stopQuiz = () => {};

  function viewMissing() {
    setTitle("Not found");
    main.innerHTML = `<h1 class="page-title">This page does not exist</h1>
      <p class="lede">The link may point to a course that was renamed in <code>data/manifest.json</code>.</p>
      <a class="btn" href="#/">Go to the readiness board</a>`;
  }

  /* ---------- Router ---------- */
  async function route() {
    stopQuiz();
    stopQuiz = () => {};
    openNav(false);
    markCurrent();
    const hash = location.hash || "#/";
    const [, kind, id] = hash.match(/^#\/(?:([cpt])\/([^/?#]+))?/) || [];
    try {
      if (kind === "c") await viewCourse(decodeURIComponent(id));
      else if (kind === "p") await viewPage(decodeURIComponent(id));
      else if (kind === "t") await viewTest(decodeURIComponent(id));
      else viewHome();
    } catch (err) {
      main.innerHTML = `<div class="error"><strong>This content could not load.</strong><p>${esc(err.message)}</p>
        <p>If you opened index.html straight from your computer, run a local server instead (see README).</p></div>`;
    }
    focusMain();
  }

  /* ---------- Backup ---------- */
  document.getElementById("export-btn").addEventListener("click", () => {
    const out = { exportedAt: new Date().toISOString(), notes: {}, best: {}, history: {} };
    manifest.courses.forEach((c) => { const n = note(c.id); if (n) out.notes[c.id] = n; });
    manifest.tests.forEach((t) => {
      const b = best(t.id); if (b) out.best[t.id] = b;
      const h = store.get("hist:" + t.id, []); if (h.length) out.history[t.id] = h;
    });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aps-notes-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  /* ---------- Start ---------- */
  (async function init() {
    try {
      manifest = await load("data/manifest.json", false);
    } catch (err) {
      main.innerHTML = `<div class="error"><strong>The study data could not load.</strong><p>${esc(err.message)}</p>
        <p>If you opened index.html straight from your computer, run a local server instead (see README).</p></div>`;
      return;
    }
    loadSheetNotes().then(refreshNotesFromSheet);
    document.getElementById("updated").textContent = manifest.updated ? `Content updated ${manifest.updated}` : "";
    renderNav();
    window.addEventListener("hashchange", route);
    route();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline cache unavailable", e));
    }
  })();
})();
