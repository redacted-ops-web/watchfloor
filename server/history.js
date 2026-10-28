// Appends a compact snapshot of data/live.json to data/history.json (kept 45 days) so the page can show a timeline.
// Usage: node server/history.js data/live.json data/history.json full|light
const fs = require('fs');
const [src, dst, mode] = [process.argv[2], process.argv[3], process.argv[4] || 'light'];
const d = JSON.parse(fs.readFileSync(src, 'utf8'));
let h = { names: {}, snaps: [] };
try { h = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch (e) { /* first run */ }
h.names = h.names || {}; h.snaps = Array.isArray(h.snaps) ? h.snaps : [];
const v = {};
['hotspots', 'chokepoints', 'incidents'].forEach(k => (d[k] || []).forEach(it => {
  const key = k + '/' + it.id;
  v[key] = Number(it.sev) || 0;
  h.names[key] = String(it.name || it.title || '').slice(0, 90);
}));
const at = (d.meta && d.meta.updatedAt) || new Date().toISOString();
const last = h.snaps[h.snaps.length - 1];
if (!last || last.t !== at) h.snaps.push({ t: at, m: mode, v });
const cutoff = Date.now() - 45 * 864e5;
h.snaps = h.snaps.filter(s => Date.parse(s.t) >= cutoff);
const live = new Set(); h.snaps.forEach(s => Object.keys(s.v).forEach(k => live.add(k)));
Object.keys(h.names).forEach(k => { if (!live.has(k)) delete h.names[k]; });
fs.writeFileSync(dst + '.tmp', JSON.stringify(h)); fs.renameSync(dst + '.tmp', dst);
console.log('history: ' + h.snaps.length + ' snapshots');
