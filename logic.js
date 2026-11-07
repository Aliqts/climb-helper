/* Climbing Helper — pure logic (no DOM). Loaded by index.html and tests.html.
 * Everything here is exposed as window.Logic. */
(function (global) {
  "use strict";

  // ------------------------------------------------------------ game rules
  const RULES = {
    heightCoefficients: { 1: 4, 2: 37, 3: 132, 4: 325, 5: 658 },
    levelChoices: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "9+"],
    maxHp: 100,
    dangerHp: 5,                       // HP left below this = "dangerous"
    ageStepMs: (4 * 24 * 3600 * 1000) / 10, // +0.1 age every 9.6 h
    cols: 10,
    rows: 6,
    maxNumber: 7,                      // 8 is never reachable
    maxHeightTabs: 5,
    // Top row cells that are always safe: first N cells, by height.
    topRowSafe: (height) => (height === 1 ? 5 : 3),
    // Jump-pair score = sum of these weights (higher score wins):
    jumpWeights: {
      distance: -1.5,        // per cell of distance from the last input cell
      info: 1.0,             // per undiscovered dangerous cell around the pair
      chance: 2.0,           // x chance (0..1) that a hint reveals a new dangerous cell
      orthogonal: 0.5,       // pair is not diagonal (more comfortable)
      wallPerpendicular: 3.0 // orthogonal pair pointing into a wall: spam-safe, no fall risk
    },
    solverNodeLimit: 2000000,
  };

  // ------------------------------------------------------------ exact fractions
  function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
  function F(n, d = 1) {
    if (d < 0) { n = -n; d = -d; }
    const g = gcd(n, d);
    return { n: n / g, d: d / g };
  }
  const add = (a, b) => F(a.n * b.d + b.n * a.d, a.d * b.d);
  const sub = (a, b) => F(a.n * b.d - b.n * a.d, a.d * b.d);
  const mul = (a, b) => F(a.n * b.n, a.d * b.d);
  const cmp = (a, b) => Math.sign(a.n * b.d - b.n * a.d);
  const floor = (a) => Math.floor(a.n / a.d);   // exact for our small integers
  const ceil = (a) => Math.ceil(a.n / a.d);
  const num = (a) => a.n / a.d;
  const max = (a, b) => (cmp(a, b) >= 0 ? a : b);

  /** "12,5" / "12.5" / "7" -> fraction, or null if not a non-negative decimal. */
  function parseDecimal(text) {
    const s = String(text).trim().replace(",", ".");
    // Max 2 decimals keeps every intermediate integer far below 2^53 (exact in JS).
    const m = /^(\d{1,4})(?:\.(\d{1,2}))?$/.exec(s);
    if (!m) return null;
    const frac = m[2] || "";
    return F(parseInt(m[1] + frac, 10), Math.pow(10, frac.length));
  }

  // ------------------------------------------------------------ damage
  function ageMultiplier(ageTenths) {
    if (ageTenths <= 30) return F(3, 2);
    if (ageTenths <= 60) return F(6, 5);
    return F(1);
  }

  /** -> {level, mastery} or null. Level 0 behaves like 1. */
  function parseLevel(text) {
    const s = String(text).trim();
    if (s === "9+") return { level: 9, mastery: true };
    if (!/^\d$/.test(s)) return null;
    return { level: Math.max(parseInt(s, 10), 1), mastery: false };
  }

  /** Damage before the final rounding (exact fraction). */
  function exactDamage(height, levelText, ageTenths, buffPercent) {
    const lv = parseLevel(levelText);
    let base = F(RULES.heightCoefficients[height], lv.level);
    if (cmp(base, F(1)) >= 0) base = F(ceil(base));          // base rounded UP
    let dmg = mul(base, ageMultiplier(ageTenths));
    if (lv.mastery) dmg = mul(dmg, F(4, 5));                  // 9+: 20% less
    dmg = mul(dmg, sub(F(1), mul(buffPercent, F(1, 100))));
    return dmg;
  }

  /** Final damage as the game shows it: nearest whole number (halves up); <1 stays exact. */
  function roundedDamage(height, levelText, ageTenths, buffPercent) {
    const d = exactDamage(height, levelText, ageTenths, buffPercent);
    if (cmp(d, F(1)) < 0) return d;
    return F(floor(add(d, F(1, 2))));
  }

  /** Larger of rounded and exact — used for HP left and every warning (safety first). */
  function worstCaseDamage(height, levelText, ageTenths, buffPercent) {
    return max(roundedDamage(height, levelText, ageTenths, buffPercent),
               exactDamage(height, levelText, ageTenths, buffPercent));
  }

  function fmtNumber(f, digits) {
    if (f.d === 1) return String(f.n);
    return num(f).toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
  }
  /** "74", "59 (59.2)", "<1 (0.36)" */
  function fmtDamage(rounded, exact) {
    const exactTxt = fmtNumber(exact, 2);
    if (cmp(rounded, F(1)) < 0) return "<1 (" + exactTxt + ")";
    return cmp(rounded, exact) === 0 ? String(rounded.n) : rounded.n + " (" + exactTxt + ")";
  }
  const fmtHp = (f) => fmtNumber(f, 1);

  /** "ok" | "danger" | "fatal" for worst-case HP left. */
  function fallStatus(left) {
    if (cmp(left, F(0)) <= 0) return "fatal";
    if (cmp(left, F(RULES.dangerHp)) < 0) return "danger";
    return "ok";
  }

  // ------------------------------------------------------------ field helpers
  const N_CELLS = RULES.cols * RULES.rows;
  const rowOf = (i) => Math.floor(i / RULES.cols);
  const colOf = (i) => i % RULES.cols;
  const cellName = (i) => "ABCDEFGHIJ"[colOf(i)] + (rowOf(i) + 1);
  const cheb = (a, b) => Math.max(Math.abs(rowOf(a) - rowOf(b)), Math.abs(colOf(a) - colOf(b)));

  const NEIGHBOURS = [];
  for (let i = 0; i < N_CELLS; i++) {
    const list = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = rowOf(i) + dr, c = colOf(i) + dc;
      if (r >= 0 && r < RULES.rows && c >= 0 && c < RULES.cols) list.push(r * RULES.cols + c);
    }
    NEIGHBOURS.push(list);
  }

  const isNumber = (v) => typeof v === "number";
  const isGuaranteedSafe = (i, height) => rowOf(i) === 0 && colOf(i) < RULES.topRowSafe(height);

  /**
   * Analyse a field.
   * cells: array of 60 values: null (unknown) | 0-7 | "D" (dangerous) | "L" (locational).
   * Returns {
   *   mine: bool[60]   dangerous (marked or deduced)
   *   deducedMine, deducedSafe: bool[60]
   *   prob: (number|null)[60]  chance of danger for undetermined frontier cells
   *   ask: int[]       known-safe cells without a number (highlight yellow)
   *   pair: [a,b]|null suggested jump pair (light blue), only when ask is empty
   *   conflicts: int[] cells whose numbers can't all be true
   *   undetermined: int[] cells still unknown (reachable ones only)
   *   unreachable: bool[60] empty cells walled off by dangerous/locational cells (shown red)
   *   done: bool, tooComplex: bool
   * }
   */
  function analyse(cells, height, lastInput) {
    const conflicts = new Set();
    const mine = cells.map((v) => v === "D");
    const deducedMine = Array(N_CELLS).fill(false);
    const deducedSafe = Array(N_CELLS).fill(false);
    const prob = Array(N_CELLS).fill(null);
    let tooComplex = false;

    const knownSafe = (i) => isNumber(cells[i]) || cells[i] === "L" || isGuaranteedSafe(i, height);
    for (let i = 0; i < N_CELLS; i++) if (cells[i] === "D" && isGuaranteedSafe(i, height)) conflicts.add(i);

    // Constraints: for each number, sum of unknown neighbours = number - marked dangerous.
    const constraints = [];
    for (let i = 0; i < N_CELLS; i++) {
      if (!isNumber(cells[i])) continue;
      const vars = [];
      let marked = 0;
      for (const j of NEIGHBOURS[i]) {
        if (cells[j] === "D") marked++;
        else if (cells[j] === null && !knownSafe(j)) vars.push(j);
      }
      const need = cells[i] - marked;
      if (need < 0 || need > vars.length) { conflicts.add(i); continue; }
      constraints.push({ cell: i, vars, need });
    }

    // Split into connected components and enumerate each exactly.
    const varCons = new Map();
    constraints.forEach((c, ci) => c.vars.forEach((v) => {
      if (!varCons.has(v)) varCons.set(v, []);
      varCons.get(v).push(ci);
    }));
    // For every empty cell: bitmask of its possible "dangerous neighbours" counts.
    // Starts with the marked dangerous neighbours; each component adds its possible sums.
    const sumMask = Array(N_CELLS).fill(0);
    const numberUncertain = Array(N_CELLS).fill(false);
    for (let i = 0; i < N_CELLS; i++) {
      if (cells[i] !== null) continue;
      sumMask[i] = 1 << NEIGHBOURS[i].filter((j) => cells[j] === "D").length;
      // an unknown neighbour that no number constrains could be anything
      if (NEIGHBOURS[i].some((j) => cells[j] === null && !knownSafe(j) && !varCons.has(j))) numberUncertain[i] = true;
    }
    const seen = new Set();
    for (const start of varCons.keys()) {
      if (seen.has(start)) continue;
      const compVars = [], compCons = new Set(), stack = [start];
      seen.add(start);
      while (stack.length) {
        const v = stack.pop();
        compVars.push(v);
        for (const ci of varCons.get(v)) {
          compCons.add(ci);
          for (const w of constraints[ci].vars) if (!seen.has(w)) { seen.add(w); stack.push(w); }
        }
      }
      // empty cells touching this component, with the component vars around each
      const compSet = new Set(compVars);
      const targets = [];
      for (let i = 0; i < N_CELLS; i++) {
        if (cells[i] !== null) continue;
        const ks = [];
        NEIGHBOURS[i].forEach((j) => { if (compSet.has(j)) ks.push(compVars.indexOf(j)); });
        if (ks.length) targets.push({ cell: i, ks });
      }
      const res = enumerate(compVars, [...compCons].map((ci) => constraints[ci]), targets);
      if (res === null) { tooComplex = true; targets.forEach((tg) => { numberUncertain[tg.cell] = true; }); continue; }
      if (res.solutions === 0) { compCons.forEach((ci) => conflicts.add(constraints[ci].cell)); continue; }
      compVars.forEach((v, k) => {
        prob[v] = res.mineCounts[k] / res.solutions;
        if (res.mineCounts[k] === res.solutions) { deducedMine[v] = true; mine[v] = true; }
        else if (res.mineCounts[k] === 0) deducedSafe[v] = true;
      });
      targets.forEach((tg, n) => { sumMask[tg.cell] = addMasks(sumMask[tg.cell], res.masks[n]); });
    }

    // Unreachable: empty cells the player can't get to without stepping on a dangerous
    // cell (walls, dangerous and locational cells block). Start from every known safe
    // standing cell; move to any of the 8 neighbours. Shown as dangerous (red).
    const unreachable = Array(N_CELLS).fill(false);
    {
      const passable = (i) => cells[i] !== "L" && !mine[i];
      const reached = Array(N_CELLS).fill(false), stack = [];
      for (let i = 0; i < N_CELLS; i++) {
        if ((isNumber(cells[i]) || isGuaranteedSafe(i, height)) && passable(i)) { reached[i] = true; stack.push(i); }
      }
      while (stack.length) {
        const v = stack.pop();
        for (const j of NEIGHBOURS[v]) if (!reached[j] && passable(j)) { reached[j] = true; stack.push(j); }
      }
      for (let i = 0; i < N_CELLS; i++) if (cells[i] === null && !mine[i] && !reached[i]) unreachable[i] = true;
    }

    // Safe empty cells whose number is certain get it calculated automatically.
    const derived = Array(N_CELLS).fill(null);
    const ask = [], undetermined = [];
    for (let i = 0; i < N_CELLS; i++) {
      if (cells[i] !== null || unreachable[i]) continue;
      if (knownSafe(i) || deducedSafe[i]) {
        const m = sumMask[i];
        if (!numberUncertain[i] && m && (m & (m - 1)) === 0) derived[i] = Math.log2(m);
        else ask.push(i);
      } else if (!deducedMine[i]) undetermined.push(i);
    }
    const done = ask.length === 0 && undetermined.length === 0;
    const effective = cells.map((v, i) => (isNumber(v) ? v : derived[i]));
    const pair = ask.length || done || conflicts.size
      ? null : chooseJumpPair(effective, mine, lastInput);

    return { mine, deducedMine, deducedSafe, prob, derived, ask, pair, undetermined, unreachable,
             conflicts: [...conflicts], done, tooComplex };
  }

  /** Possible totals of two independent counts, as bitmasks. */
  function addMasks(a, b) {
    let out = 0;
    for (let x = 0; x <= 8; x++) if (a & (1 << x)) for (let y = 0; x + y <= 8; y++) if (b & (1 << y)) out |= 1 << (x + y);
    return out;
  }

  /** Exact backtracking over one component. Returns null if over the node limit.
   *  targets: [{ks: var indices}] -> masks[n] = possible sums of those vars. */
  function enumerate(vars, cons, targets = []) {
    const idx = new Map(vars.map((v, k) => [v, k]));
    const cs = cons.map((c) => ({ need: c.need, vars: c.vars.map((v) => idx.get(v)) }));
    const byVar = vars.map(() => []);
    cs.forEach((c, ci) => c.vars.forEach((k) => byVar[k].push(ci)));
    const assigned = cs.map(() => 0), remaining = cs.map((c) => c.vars.length);
    const val = Array(vars.length).fill(0);
    const mineCounts = Array(vars.length).fill(0);
    const masks = targets.map(() => 0);
    let solutions = 0, nodes = 0, aborted = false;

    (function go(k) {
      if (aborted) return;
      if (++nodes > RULES.solverNodeLimit) { aborted = true; return; }
      if (k === vars.length) {
        solutions++;
        for (let j = 0; j < vars.length; j++) mineCounts[j] += val[j];
        for (let n = 0; n < targets.length; n++) {
          let s = 0;
          for (const kk of targets[n].ks) s += val[kk];
          masks[n] |= 1 << s;
        }
        return;
      }
      for (const x of [0, 1]) {
        let ok = true;
        for (const ci of byVar[k]) {
          const a = assigned[ci] + x, r = remaining[ci] - 1;
          if (a > cs[ci].need || a + r < cs[ci].need) { ok = false; break; }
        }
        if (!ok) continue;
        for (const ci of byVar[k]) { assigned[ci] += x; remaining[ci]--; }
        val[k] = x;
        go(k + 1);
        for (const ci of byVar[k]) { assigned[ci] -= x; remaining[ci]++; }
        val[k] = 0;
      }
    })(0);
    return aborted ? null : { solutions, mineCounts, masks };
  }

  /** Orthogonal pair whose line points into a wall, with one cell against that wall. */
  function isWallPerpendicular(a, b) {
    const dr = rowOf(b) - rowOf(a), dc = colOf(b) - colOf(a);
    if (dr && dc) return false;
    const out = (i, sr, sc) => {
      const r = rowOf(i) + sr, c = colOf(i) + sc;
      return r < 0 || r >= RULES.rows || c < 0 || c >= RULES.cols;
    };
    return out(b, dr, dc) || out(a, -dr, -dc);
  }

  /** Score parts for a candidate pair (see RULES.jumpWeights). */
  function jumpScore(parts) {
    const w = RULES.jumpWeights;
    return w.distance * parts.distance + w.info * parts.info + w.chance * parts.chance +
      (parts.orthogonal ? w.orthogonal : 0) + (parts.wallPerpendicular ? w.wallPerpendicular : 0);
  }

  /**
   * Two adjacent safe cells with known numbers to jump between for a hint
   * (a revealed nearby dangerous cell). Per cell: undiscovered = number - known dangerous
   * neighbours (marked or deduced). Candidates need at least one undiscovered.
   *  distance: from the last input cell     info: undiscovered around both combined
   *  chance:   chance a hint is a new one (cell with number n, u undiscovered: u/n)
   *  orthogonal / wallPerpendicular: comfort and spam-safety bonuses.
   * numbers: entered or calculated number per cell (null otherwise).
   */
  function chooseJumpPair(numbers, mine, lastInput) {
    const stats = numbers.map((v, i) => {
      if (!isNumber(v)) return null;
      const known = NEIGHBOURS[i].filter((j) => mine[j]).length;
      const u = Math.max(0, v - known);
      return { u, p: v > 0 ? u / v : 0 };
    });
    let best = null;
    for (let a = 0; a < N_CELLS; a++) {
      if (!stats[a]) continue;
      for (const b of NEIGHBOURS[a]) {
        if (b < a || !stats[b]) continue;
        const info = stats[a].u + stats[b].u;
        if (info === 0) continue;
        const orthogonal = rowOf(a) === rowOf(b) || colOf(a) === colOf(b);
        const score = jumpScore({
          distance: lastInput == null ? 0 : Math.min(cheb(lastInput, a), cheb(lastInput, b)),
          info,
          chance: 1 - (1 - stats[a].p) * (1 - stats[b].p),
          orthogonal,
          wallPerpendicular: orthogonal && isWallPerpendicular(a, b),
        });
        if (!best || score > best.score + 1e-9) best = { pair: [a, b], score };
      }
    }
    return best ? best.pair : null;
  }

  global.Logic = {
    RULES, F, add, sub, mul, cmp, num, max, parseDecimal,
    ageMultiplier, parseLevel, exactDamage, roundedDamage, worstCaseDamage,
    fmtDamage, fmtHp, fmtNumber, fallStatus,
    N_CELLS, NEIGHBOURS, rowOf, colOf, cellName, cheb, isGuaranteedSafe, analyse, chooseJumpPair, isWallPerpendicular, jumpScore,
  };
})(typeof window !== "undefined" ? window : globalThis);
