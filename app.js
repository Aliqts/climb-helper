/* Climbing Helper — UI, state and saving. Logic lives in logic.js, texts in texts.js. */
(function () {
  "use strict";
  const L = window.Logic, R = L.RULES, T = window.TEXTS;
  const STORAGE_KEY = "climbHelper.v1";
  const HISTORY_LIMIT = 200;
  const $ = (id) => document.getElementById(id);

  /** Text from texts.js with {placeholders} filled in. */
  function t(key, vars) {
    let s = T[key] != null ? String(T[key]) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  // ------------------------------------------------------------ state
  const uid = () => Math.random().toString(36).slice(2, 10);
  const newHeight = (n) => ({
    id: uid(), name: t("newHeightName", { n }),
    cells: Array(L.N_CELLS).fill(null), phase: "locational",
    lastInput: null, selected: null, history: [], confirmedLeft: null,
  });
  const newLocation = (n) => ({ id: uid(), name: t("newLocationName", { n }), activeHeight: 0, heights: [newHeight(1)] });
  function defaultState() {
    const loc = newLocation(1);
    return {
      version: 1,
      character: { ageText: "", ageTenths: null, ageSetAt: null, level: "1", buff: "0", hp: String(R.maxHp) },
      locations: [loc], activeLocation: loc.id, mode: "select", locationCounter: 1,
    };
  }

  function isValidState(s) {
    return s && s.version === 1 && s.character && Array.isArray(s.locations) && s.locations.length > 0 &&
      s.locations.every((l) => Array.isArray(l.heights) && l.heights.length > 0 &&
        l.heights.every((h) => Array.isArray(h.cells) && h.cells.length === L.N_CELLS));
  }

  let storageOk = true;
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (isValidState(s)) return s;
    } catch (e) { /* fall through */ }
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); storageOk = true; }
    catch (e) { storageOk = false; }
    $("storage-warning").hidden = storageOk;
  }

  let state = load();
  const loc = () => state.locations.find((l) => l.id === state.activeLocation) || state.locations[0];
  const hTab = () => loc().heights[loc().activeHeight] || loc().heights[0];
  const heightNum = () => loc().activeHeight + 1;

  // ------------------------------------------------------------ age
  const fmtAge = (tenths) => Math.floor(tenths / 10) + "." + (tenths % 10);
  function currentAgeTenths() {
    const c = state.character;
    if (c.ageTenths == null || c.ageSetAt == null) return null;
    return c.ageTenths + Math.max(0, Math.floor((Date.now() - c.ageSetAt) / R.ageStepMs));
  }
  let shownAge = null; // the age text the program itself put in the box

  // ------------------------------------------------------------ part 1
  function readCharacter() {
    const c = state.character;
    const age = L.parseDecimal(c.ageText);
    if (!age) return { error: t("errorAge") };
    if (!L.parseLevel(c.level)) return { error: t("errorLevel") };
    const buff = L.parseDecimal(c.buff === "" ? "0" : c.buff);
    if (!buff || L.cmp(buff, L.F(100)) > 0) return { error: t("errorBuff") };
    const hp = L.parseDecimal(c.hp);
    if (!hp || L.cmp(hp, L.F(R.maxHp)) > 0) return { error: t("errorHp", { max: R.maxHp }) };
    return { ageTenths: Math.round((age.n * 10) / age.d), level: c.level, buff, hp };
  }

  function fallInfo(ch, height) {
    const args = [height, ch.level, ch.ageTenths, ch.buff];
    const rounded = L.roundedDamage(...args), exact = L.exactDamage(...args);
    const left = L.sub(ch.hp, L.worstCaseDamage(...args));
    return { label: L.fmtDamage(rounded, exact), left, status: L.fallStatus(left) };
  }

  /** Called whenever the character inputs change. */
  function onCharacterInput() {
    const c = state.character;
    const typed = $("age").value;
    c.ageText = typed;
    const age = L.parseDecimal(typed);
    // Only reset the age clock when the user typed a new age themselves.
    if (age && (typed !== shownAge || c.ageSetAt == null)) {
      c.ageTenths = Math.round((age.n * 10) / age.d);
      c.ageSetAt = Date.now();
      shownAge = typed;
    }
    c.level = $("level").value;
    c.buff = $("buff").value;
    c.hp = $("hp").value;
    save();
    render();
  }

  function renderCharacter() {
    const ch = readCharacter();
    const body = $("heights-body");
    body.textContent = "";
    const warning = $("warning");
    renderAgeNote();
    if (ch.error) {
      $("result").textContent = ch.error;
      warning.textContent = ""; warning.className = "warning";
      return null;
    }
    for (let h = 1; h <= 5; h++) {
      const f = fallInfo(ch, h);
      const tr = document.createElement("tr");
      if (f.status === "fatal") tr.className = "dead";
      else if (f.status === "danger") tr.className = "danger";
      if (h === heightNum()) tr.classList.add("active");
      const leftTxt = L.fmtHp(f.left) + (f.status === "fatal" ? "  " + t("deadMark") : "");
      for (const v of [h, f.label, leftTxt]) {
        const td = document.createElement("td"); td.textContent = v; tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    const h = heightNum(), f = fallInfo(ch, h);
    const zero = L.F(0);
    let text = t("resultDamage", { height: h, damage: f.label }) + "\n" +
      t("resultHpLeft", { left: L.fmtHp(L.max(f.left, zero)), max: R.maxHp });
    if (L.cmp(f.left, zero) < 0) text += "\n" + t("resultExceeds", { over: L.fmtHp(L.sub(zero, f.left)) });
    $("result").textContent = text;
    warning.className = "warning " + f.status;
    warning.textContent = f.status === "fatal" ? t("warnFatal")
      : f.status === "danger" ? t("warnDanger", { left: L.fmtHp(f.left) }) : t("warnOk");
    return f;
  }

  function renderAgeNote() {
    const c = state.character;
    if (c.ageSetAt == null || c.ageTenths == null) { $("age-note").textContent = t("ageNoteEmpty"); return; }
    const steps = Math.floor((Date.now() - c.ageSetAt) / R.ageStepMs);
    const next = new Date(c.ageSetAt + (steps + 1) * R.ageStepMs);
    const time = next.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    $("age-note").textContent = t("ageNoteAuto", { time });
  }

  function tick() {
    const tenths = currentAgeTenths();
    if (tenths != null && $("age").value === shownAge) {
      const next = fmtAge(tenths);
      if (next !== shownAge) {
        shownAge = next;
        $("age").value = next;
        state.character.ageText = next;
        save();
        render();
        return;
      }
    }
    renderAgeNote();
  }

  // ------------------------------------------------------------ part 2: tabs
  function renderTabs() {
    const lt = $("location-tabs"); lt.textContent = "";
    for (const l of state.locations) {
      const b = document.createElement("button");
      b.textContent = l.name; b.title = t("renameTooltip");
      if (l.id === state.activeLocation) b.className = "active";
      b.onclick = () => { state.activeLocation = l.id; save(); render(); };
      b.ondblclick = () => renameLocation(l);
      lt.appendChild(b);
    }
    const addL = document.createElement("button");
    addL.className = "add"; addL.textContent = t("addLocation");
    addL.onclick = () => {
      state.locationCounter = (state.locationCounter || state.locations.length) + 1;
      const l = newLocation(state.locationCounter);
      state.locations.push(l); state.activeLocation = l.id; save(); render();
    };
    lt.appendChild(addL);
    $("delete-location").disabled = state.locations.length < 2;

    const ht = $("height-tabs"); ht.textContent = "";
    const l = loc();
    l.heights.forEach((h, i) => {
      const b = document.createElement("button");
      b.textContent = h.name;
      b.title = t("heightTag", { n: i + 1 }) + " — " + t("renameTooltip");
      if (i === l.activeHeight) b.className = "active";
      b.onclick = () => { l.activeHeight = i; save(); render(); };
      b.ondblclick = () => renameHeight(h);
      ht.appendChild(b);
    });
    const addH = document.createElement("button");
    addH.className = "add";
    const full = l.heights.length >= R.maxHeightTabs;
    addH.textContent = full ? t("addHeightMax", { max: R.maxHeightTabs }) : t("addHeight");
    addH.disabled = full;
    addH.onclick = () => {
      l.heights.push(newHeight(l.heights.length + 1));
      l.activeHeight = l.heights.length - 1; save(); render();
    };
    ht.appendChild(addH);
    const del = $("delete-height");
    del.disabled = l.heights.length < 2 || l.activeHeight !== l.heights.length - 1;
    del.title = t("deleteHeightOnlyLast");
  }

  function renameLocation(l) {
    const name = prompt(t("renameLocationPrompt"), l.name);
    if (name != null && name.trim()) { l.name = name.trim(); save(); render(); }
  }
  function renameHeight(h) {
    const name = prompt(t("renameHeightPrompt"), h.name);
    if (name != null && name.trim()) { h.name = name.trim(); save(); render(); }
  }

  // ------------------------------------------------------------ part 2: field
  const MODES = ["select", "0", "1", "2", "3", "4", "5", "6", "7", "D", "L", "erase"];
  const modeLabel = (m) => ({ select: t("modeSelect"), D: t("modeDanger"), L: t("modeLocational"), erase: t("modeErase") }[m] || m);
  const modeValue = (m) => (m === "D" || m === "L" ? m : m === "erase" ? null : parseInt(m, 10));

  let locked = false;
  let cellButtons = [];

  function snapshot(h) { return { cells: h.cells.slice(), phase: h.phase, lastInput: h.lastInput }; }
  function pushHistory(h) {
    h.history.push(snapshot(h));
    if (h.history.length > HISTORY_LIMIT) h.history.shift();
  }
  function undo() {
    const h = hTab();
    if (locked || !h.history.length) return;
    Object.assign(h, h.history.pop());
    save(); render();
  }

  function setCell(i, value) {
    const h = hTab();
    if (locked || h.cells[i] === value) { h.selected = i; save(); render(); return; }
    pushHistory(h);
    h.cells[i] = value;
    h.lastInput = i;
    h.selected = i;
    save(); render();
  }

  function onCellClick(i) {
    if (locked) return;
    const h = hTab();
    if (state.mode === "select") { h.selected = i; save(); render(); return; }
    setCell(i, modeValue(state.mode));
  }

  function buildField() {
    const f = $("field"); f.textContent = "";
    f.appendChild(document.createElement("span"));
    for (let c = 0; c < R.cols; c++) {
      const s = document.createElement("span"); s.className = "head"; s.textContent = "ABCDEFGHIJ"[c]; f.appendChild(s);
    }
    cellButtons = [];
    for (let r = 0; r < R.rows; r++) {
      const s = document.createElement("span"); s.className = "head"; s.textContent = r + 1; f.appendChild(s);
      for (let c = 0; c < R.cols; c++) {
        const i = r * R.cols + c;
        const b = document.createElement("button");
        b.className = "cell";
        b.onclick = () => onCellClick(i);
        f.appendChild(b);
        cellButtons.push(b);
      }
    }
    const m = $("modes"); m.textContent = "";
    for (const mode of MODES) {
      const b = document.createElement("button");
      b.textContent = modeLabel(mode);
      b.dataset.mode = mode;
      b.onclick = () => { state.mode = mode; save(); render(); };
      m.appendChild(b);
    }
  }

  function renderField(fall) {
    const h = hTab(), height = heightNum();
    const solving = h.phase === "solve";
    const a = solving ? L.analyse(h.cells, height, h.lastInput) : null;
    const conflicts = new Set(a ? a.conflicts : []);
    const ask = new Set(a ? a.ask : []);
    const pair = new Set(a && a.pair ? a.pair : []);

    cellButtons.forEach((b, i) => {
      const v = h.cells[i];
      const cls = ["cell"];
      let text = "", tip = t("cellTooltip", { cell: L.cellName(i) });
      if (typeof v === "number") { cls.push("num"); text = String(v); }
      else if (v === "L") { cls.push("loc"); text = t("cellLocational"); }
      else if (v === "D") { cls.push("danger"); text = t("cellDanger"); }
      else if (a && a.deducedMine[i]) { cls.push("danger", "deduced"); text = t("cellDanger"); }
      else if (a && a.unreachable[i]) {
        cls.push("danger", "unreachable"); text = t("cellUnreachable");
        tip = t("unreachableTooltip", { cell: L.cellName(i) });
      }
      else if (a && a.derived[i] != null) {
        cls.push("num", "derived"); text = String(a.derived[i]);
        tip = t("derivedTooltip", { cell: L.cellName(i), number: a.derived[i] });
      }
      else if (ask.has(i)) cls.push("ask");
      else if (L.isGuaranteedSafe(i, height)) cls.push("safe-top");
      if (pair.has(i)) cls.push("jump");
      if (conflicts.has(i)) cls.push("conflict");
      if (h.selected === i) cls.push("selected");
      b.className = cls.join(" ");
      b.textContent = text;
      if (a && v === null && a.prob[i] != null && !a.deducedMine[i] && !a.deducedSafe[i] && !a.unreachable[i]) {
        const pct = Math.round(a.prob[i] * 100);
        tip = t("probTooltip", { cell: L.cellName(i), percent: pct, safe: 100 - pct });
        const p = document.createElement("span"); p.className = "prob"; p.textContent = pct + "%";
        b.appendChild(p);
      }
      if (conflicts.has(i)) tip += " — " + t("conflictTooltip");
      b.title = tip;
    });

    // guidance banner
    const g = $("guide");
    g.className = "guide";
    if (!solving) g.textContent = t("stepLocational", { button: t("doneLocational") });
    else if (a.conflicts.length) {
      g.className = "guide conflict";
      g.textContent = t("stepConflict", { cells: a.conflicts.map(L.cellName).join(", ") });
    } else if (a.done) { g.className = "guide done"; g.textContent = t("stepDone"); }
    else if (a.ask.length) g.textContent = t("stepFill", { count: a.ask.length });
    else if (a.pair) g.textContent = t("stepJump", { a: L.cellName(a.pair[0]), b: L.cellName(a.pair[1]) });
    else g.textContent = t("stepStuck", { count: a.undetermined.length });
    if (a && a.tooComplex) g.textContent += "\n" + t("stepTooComplex");

    // tools
    for (const b of $("modes").children) b.classList.toggle("active", b.dataset.mode === state.mode);
    $("phase-button").textContent = solving ? t("backToLocational") : t("doneLocational");
    $("undo").disabled = !h.history.length;

    renderLock(h, fall);
  }

  /** Lock the field while the fall is dangerous/fatal until the user confirms. */
  function renderLock(h, fall) {
    const lock = $("lock");
    if (!fall || fall.status === "ok") {
      if (fall && h.confirmedLeft != null) { h.confirmedLeft = null; save(); }
      locked = false; lock.hidden = true; return;
    }
    const left = L.num(fall.left);
    // Stays unlocked only while things are not worse than when the user confirmed.
    locked = h.confirmedLeft == null || left < h.confirmedLeft - 1e-9;
    lock.hidden = !locked;
    if (locked) {
      $("lock-title").textContent = t("lockTitle", { status: fall.status === "fatal" ? t("lockStatusFatal") : t("lockStatusDanger") });
      $("lock-body").textContent = t("lockBody", { left: L.fmtHp(fall.left) });
      $("lock-confirm").onclick = () => { h.confirmedLeft = left; save(); render(); };
    }
  }

  // ------------------------------------------------------------ keyboard
  document.addEventListener("keydown", (e) => {
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const h = hTab();
    if (h.selected == null || locked) return;
    const i = h.selected;
    const k = e.key;
    if (/^[0-7]$/.test(k)) setCell(i, parseInt(k, 10));
    else if (k === "-" || k === "Subtract") setCell(i, "D");
    else if (k === "=") setCell(i, "L");
    else if (k === "Backspace" || k === "Delete") setCell(i, null);
    else if (k.startsWith("Arrow")) {
      const r = L.rowOf(i), c = L.colOf(i);
      const nr = Math.min(R.rows - 1, Math.max(0, r + (k === "ArrowDown") - (k === "ArrowUp")));
      const nc = Math.min(R.cols - 1, Math.max(0, c + (k === "ArrowRight") - (k === "ArrowLeft")));
      h.selected = nr * R.cols + nc; save(); render();
      cellButtons[h.selected].focus();
    } else return;
    e.preventDefault();
  });

  // ------------------------------------------------------------ wiring
  function render() {
    const fall = renderCharacter();
    renderTabs();
    renderField(fall);
  }

  function init() {
    document.title = t("pageTitle");
    document.querySelectorAll("[data-t]").forEach((el) => { el.textContent = t(el.dataset.t); });
    $("hp-label").textContent = t("hpLabel", { max: R.maxHp });
    $("storage-warning").textContent = t("storageWarning");
    $("age").placeholder = t("agePlaceholder");
    for (const lv of R.levelChoices) {
      const o = document.createElement("option"); o.value = lv; o.textContent = lv; $("level").appendChild(o);
    }

    const c = state.character;
    const tenths = currentAgeTenths();
    if (tenths != null) { c.ageText = fmtAge(tenths); shownAge = c.ageText; }
    $("age").value = c.ageText;
    $("level").value = c.level;
    $("buff").value = c.buff;
    $("hp").value = c.hp;
    for (const id of ["age", "buff", "hp"]) $(id).addEventListener("input", onCharacterInput);
    $("level").addEventListener("change", onCharacterInput);

    $("rename-location").onclick = () => renameLocation(loc());
    $("rename-height").onclick = () => renameHeight(hTab());
    $("delete-location").onclick = () => {
      const l = loc();
      if (state.locations.length < 2 || !confirm(t("deleteLocationConfirm", { name: l.name }))) return;
      const idx = state.locations.indexOf(l);
      state.locations.splice(idx, 1);
      state.activeLocation = state.locations[Math.max(0, idx - 1)].id;
      save(); render();
    };
    $("delete-height").onclick = () => {
      const l = loc(), h = hTab();
      if (l.heights.length < 2 || l.activeHeight !== l.heights.length - 1) { alert(t("deleteHeightOnlyLast")); return; }
      if (!confirm(t("deleteHeightConfirm", { name: h.name }))) return;
      l.heights.pop(); l.activeHeight = l.heights.length - 1; save(); render();
    };
    $("phase-button").onclick = () => {
      const h = hTab();
      if (locked) return;
      pushHistory(h);
      h.phase = h.phase === "solve" ? "locational" : "solve";
      save(); render();
    };
    $("undo").onclick = undo;
    $("reset-field").onclick = () => {
      const h = hTab();
      if (locked || !confirm(t("resetFieldConfirm", { name: h.name }))) return;
      pushHistory(h);
      h.cells = Array(L.N_CELLS).fill(null); h.phase = "locational"; h.lastInput = null; h.selected = null;
      save(); render();
    };
    $("export").onclick = () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "climb-helper-save.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    $("import").onclick = () => $("import-file").click();
    $("import-file").onchange = async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (!file) return;
      try {
        const s = JSON.parse(await file.text());
        if (!isValidState(s)) throw new Error("invalid");
        if (!confirm(t("importConfirm"))) return;
        state = s; save(); location.reload();
      } catch (err) { alert(t("importError")); }
    };

    buildField();
    save();
    render();
    setInterval(tick, 60000);
  }

  init();
})();
