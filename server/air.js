// INTSUM military aircraft counter (adsb.lol public API, no key). Run from repo root: node server/air.js
// Counts ADS-B-visible military aircraft per watch region, keeps a 7-day sample history for a baseline.
// ADS-B is volunteer-fed and many military flights do not broadcast, so counts are a floor, not a total.
const fs = require('fs');
const OUT = 'data/air.json', HIST = 'data/air-history.json', URL = 'https://api.adsb.lol/v2/mil';
const REGIONS = [
  { id: 'gulf', name: 'Gulf and Hormuz', box: [22, 31, 47, 60] },
  { id: 'levant', name: 'Eastern Med and Levant', box: [30, 37, 29, 37] },
  { id: 'redsea', name: 'Red Sea', box: [12, 28, 32, 45] },
  { id: 'blacksea', name: 'Black Sea', box: [40, 48, 27, 42] },
  { id: 'baltic', name: 'Baltic', box: [53, 60, 14, 30] },
  { id: 'taiwan', name: 'Taiwan Strait', box: [21, 27, 117, 124] },
  { id: 'korea', name: 'Korea', box: [33, 39, 124, 131] }
];
function count(ac) {
  const res = { total: 0, regions: {} };
  REGIONS.forEach(r => { res.regions[r.id] = 0; });
  ac.forEach(a => {
    if (!a || typeof a.lat !== 'number' || typeof a.lon !== 'number') return;
    res.total++;
    REGIONS.forEach(r => { const b = r.box; if (a.lat >= b[0] && a.lat <= b[1] && a.lon >= b[2] && a.lon <= b[3]) res.regions[r.id]++; });
  });
  return res;
}
const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2); };
module.exports = { count, median, REGIONS };

async function main() {
  const now = Date.now(), checkedAt = new Date(now).toISOString();
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* none */ }
  let hist = []; try { hist = JSON.parse(fs.readFileSync(HIST, 'utf8')); } catch (e) { /* none */ }
  let c, err;
  for (let i = 0; i < 2 && !c; i++) {
    try {
      const r = await fetch(URL, { headers: { 'User-Agent': 'intsum-dashboard/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j || !Array.isArray(j.ac)) throw new Error('unrecognised format');
      c = count(j.ac);
    } catch (e) { err = String(e.message || e); await new Promise(s => setTimeout(s, 3000)); }
  }
  let res;
  if (c) {
    hist = hist.filter(x => x && now - Date.parse(x.t) < 7 * 864e5); hist.push({ t: checkedAt, total: c.total, r: c.regions });
    const base = {}; REGIONS.forEach(r => { const v = hist.map(h => h.r && h.r[r.id]).filter(v => typeof v === 'number'); base[r.id] = v.length >= 24 ? median(v) : null; });
    res = { ok: true, checkedAt, total: c.total, regions: REGIONS.map(r => ({ id: r.id, name: r.name, n: c.regions[r.id], usual: base[r.id] })), samples: hist.length };
    fs.writeFileSync(HIST + '.tmp', JSON.stringify(hist)); fs.renameSync(HIST + '.tmp', HIST); fs.chmodSync(HIST, 0o644);
  } else res = Object.assign(old || { regions: [] }, { ok: false, checkedAt, error: err });
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(res)); fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(checkedAt + ' air ' + (res.ok ? 'OK total=' + res.total + ' ' + res.regions.map(r => r.id + '=' + r.n).join(' ') : 'FAIL ' + err));
}
if (require.main === module) main().catch(e => { console.error('air failed: ' + e); process.exit(1); });
