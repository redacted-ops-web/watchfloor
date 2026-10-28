// INTSUM pizza collector. Run from the repo root: node server/pizza.js
// Fetches the Pentagon Pizza Index source, validates it, keeps our own status and a 7-day history,
// and writes data/pizza.json for the page. If the source is down it keeps the last good data and says so.
const fs = require('fs');
const SRC = 'https://www.pizzint.watch/api/dashboard-data';
const OUT = 'data/pizza.json', HIST = 'data/pizza-history.json', STATE = 'data/pizza-state.json';
const NOW = new Date().toISOString();
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return d; } };
const write = (f, o) => { fs.writeFileSync(f + '.tmp', JSON.stringify(o)); fs.renameSync(f + '.tmp', f); fs.chmodSync(f, 0o644); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function get() {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(SRC, { headers: { 'User-Agent': 'intsum-dashboard/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.data) || !j.data.length) throw new Error('unexpected response shape');
      return j;
    } catch (e) { err = e; await sleep(3000); }
  }
  throw err;
}

(async () => {
  const state = read(STATE, { lastLive: {}, noLiveSince: null });
  let j, error = null;
  try { j = await get(); } catch (e) { error = String(e.message || e); }
  if (error) {
    const old = read(OUT, null);
    if (!old) { console.error(NOW + ' FAIL (no previous data): ' + error); process.exit(1); }
    old.ours = Object.assign({}, old.ours || {}, { ok: false, error, checkedAt: NOW });
    write(OUT, old); console.log(NOW + ' FAIL ' + error); return;
  }
  const places = {}; let live = 0;
  j.data.forEach(p => {
    const v = typeof p.current_popularity === 'number' ? p.current_popularity : null;
    places[p.place_id] = v;
    if (v !== null) { live++; state.lastLive[p.place_id] = { t: p.recorded_at || NOW, v, pct: p.percentage_of_usual == null ? null : p.percentage_of_usual }; }
  });
  if (live > 0) state.noLiveSince = null; else if (!state.noLiveSince) state.noLiveSince = NOW;
  j.ours = { ok: true, checkedAt: NOW, liveCount: live, total: j.data.length, noLiveSince: state.noLiveSince, lastLive: state.lastLive };
  write(OUT, j); write(STATE, state);
  const cut = Date.now() - 7 * 864e5;
  const h = read(HIST, []).filter(x => x && Date.parse(x.t) >= cut); h.push({ t: NOW, live, places });
  write(HIST, h);
  console.log(NOW + ' OK live=' + live + '/' + j.data.length);
})();
