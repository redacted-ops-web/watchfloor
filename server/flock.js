// INTSUM Flock camera collector. Run from repo root: node server/flock.js
// Reads community-mapped ALPR cameras tagged Flock in OpenStreetMap (ODbL) via the public Overpass API,
// writes data/flock.json as {updatedAt, n, pts:[lat,lon,lat,lon,...]} (4 decimals, ~11 m). Keeps old data on failure.
const fs = require('fs');
const OUT = 'data/flock.json';
const HOSTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
const Q = '[out:json][timeout:240];area["ISO3166-1"="US"][admin_level=2]->.us;(' +
  'node["man_made"="surveillance"]["manufacturer"~"flock",i](area.us);' +
  'node["man_made"="surveillance"]["brand"~"flock",i](area.us););out qt;';

const COMPASS = { N: 0, NNE: 22.5, NE: 45, ENE: 67.5, E: 90, ESE: 112.5, SE: 135, SSE: 157.5, S: 180, SSW: 202.5, SW: 225, WSW: 247.5, W: 270, WNW: 292.5, NW: 315, NNW: 337.5 };
function dirOf(t) {
  const v = String((t && (t['camera:direction'] || t.direction)) || '').split(';')[0].trim().toUpperCase();
  if (!v) return -1;
  if (v in COMPASS) return COMPASS[v];
  const n = Number(v); return Number.isFinite(n) ? ((Math.round(n) % 360) + 360) % 360 : -1;
}
function parse(j) {
  if (!j || !Array.isArray(j.elements)) return null;
  const seen = new Set(), out = { pts: [], ids: [], dir: [], op: {} };
  j.elements.forEach(e => {
    if (!e || typeof e.lat !== 'number' || typeof e.lon !== 'number') return;
    const la = Math.round(e.lat * 1e4) / 1e4, lo = Math.round(e.lon * 1e4) / 1e4, k = la + ',' + lo;
    if (seen.has(k)) return; seen.add(k);
    const t = e.tags || {}, idx = out.ids.length;
    out.pts.push(la, lo); out.ids.push(e.id); out.dir.push(dirOf(t));
    const op = t.operator || t['operator:short'] || ''; if (op) out.op[idx] = String(op).slice(0, 60);
  });
  return out;
}
module.exports = { parse };

async function main() {
  const now = new Date().toISOString();
  let pts, err;
  for (let i = 0; i < 4 && !pts; i++) {
    try {
      const r = await fetch(HOSTS[i % HOSTS.length], { method: 'POST', headers: { 'User-Agent': 'intsum-dashboard/1.0', 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(Q), signal: AbortSignal.timeout(280000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const p = parse(await r.json());
      if (!p || p.pts.length < 200) throw new Error('too few results (' + (p ? p.pts.length / 2 : 0) + ')');
      pts = p;
    } catch (e) { err = String(e.message || e); await new Promise(s => setTimeout(s, 15000)); }
  }
  if (!pts) { console.log(now + ' flock FAIL ' + err + ' (kept old data)'); process.exit(0); }
  fs.writeFileSync(OUT + '.tmp', JSON.stringify({ updatedAt: now, n: pts.pts.length / 2, pts: pts.pts, ids: pts.ids, dir: pts.dir, op: pts.op })); fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(now + ' flock OK n=' + pts.pts.length / 2);
}
if (require.main === module) main().catch(e => { console.error('flock failed: ' + e); process.exit(1); });
