// INTSUM chokepoint transit collector (IMF PortWatch daily chokepoint data, public ArcGIS service, no key).
// Satellite-derived daily vessel transit counts, published with a lag of days. Run from repo root: node server/portwatch.js
// Writes data/portwatch.json: per chokepoint, latest 7-day average vs the average of the earlier days in a roughly 13-month window.
const fs = require('fs');
const OUT = 'data/portwatch.json';
const BASE = 'https://services9.arcgis.com/weJ1QsnbMYJlCHdG/ArcGIS/rest/services/Daily_Chokepoints_Data/FeatureServer/0/query';
const WANT = [['hormuz', /hormuz/i], ['babel', /bab/i], ['suez', /suez/i], ['bosporus', /bosp/i], ['malacca', /malacca/i], ['taiwan', /taiwan/i], ['panama', /panama/i]];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

function summarize(rows) {
  // rows: [{portname, date(ms), n_total, n_tanker}] for one chokepoint
  const byDay = {}; rows.forEach(r => { const d = typeof r.date === 'number' ? r.date : Date.parse(r.date); if (isFinite(d) && isFinite(Number(r.n_total))) byDay[d] = r; });
  const days = Object.keys(byDay).map(Number).sort((a, b) => b - a);
  if (days.length < 20) return null;
  const rec = days.slice(0, 7).map(d => Number(byDay[d].n_total)), old = days.slice(7).map(d => Number(byDay[d].n_total));
  const rt = days.slice(0, 7).map(d => Number(byDay[d].n_tanker) || 0), ot = days.slice(7).map(d => Number(byDay[d].n_tanker) || 0);
  const a7 = avg(rec), b = avg(old);
  return { asOf: new Date(days[0]).toISOString().slice(0, 10), avg7: Math.round(a7 * 10) / 10, base: Math.round(b * 10) / 10, pct: b > 0 ? Math.round((a7 / b - 1) * 100) : null, tanker7: Math.round(avg(rt) * 10) / 10, tankerBase: Math.round(avg(ot) * 10) / 10, last: Number(byDay[days[0]].n_total) };
}
module.exports = { summarize };

async function q(params) {
  let err;
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(BASE + '?' + new URLSearchParams(Object.assign({ f: 'json', returnGeometry: 'false' }, params)), { headers: { 'User-Agent': 'intsum-dashboard/1.0' }, signal: AbortSignal.timeout(40000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 200));
      return j;
    } catch (e) { err = e; await sleep(3000); }
  }
  throw err;
}
async function main() {
  const now = Date.now(), checkedAt = new Date(now).toISOString();
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* none */ }
  if (old && old.ok && now - Date.parse(old.checkedAt) < 6 * 3600e3) return; // data changes weekly; check at most every 6 h
  let res;
  try {
    const names = (await q({ where: '1=1', outFields: 'portname', returnDistinctValues: 'true' })).features.map(f => f.attributes.portname);
    const pick = WANT.map(([id, re]) => ({ id, name: names.find(n => re.test(n)) })).filter(x => x.name);
    if (!pick.length) throw new Error('no chokepoint names matched: ' + names.slice(0, 8).join('|'));
    const since = new Date(now - 400 * 864e5).toISOString().slice(0, 10) + ' 00:00:00', ports = []; let sample = null;
    for (const p of pick) {
      const where = "portname IN ('" + p.name.replace(/'/g, "''") + "') AND date >= timestamp '" + since + "'";
      const j = await q({ where, outFields: 'portname,date,n_total,n_tanker', orderByFields: 'date DESC', resultRecordCount: '2000' });
      const rows = j.features.map(f => f.attributes); sample = sample || rows[0];
      const s = summarize(rows); if (s) ports.push(Object.assign({ id: p.id, name: p.name }, s));
    }
    if (!ports.length) throw new Error('no usable rows, sample ' + JSON.stringify(sample));
    res = { ok: true, checkedAt, ports };
  } catch (e) { res = Object.assign(old || { ports: [] }, { ok: false, checkedAt, error: String(e.message || e) }); }
  fs.writeFileSync(OUT + '.tmp', JSON.stringify(res)); fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(checkedAt + ' portwatch ' + (res.ok ? 'OK ' + res.ports.map(p => p.id + '=' + p.avg7 + '/d(' + p.pct + '%)' + p.asOf).join(' ') : 'FAIL ' + res.error));
}
if (require.main === module) main().catch(e => { console.error('portwatch failed: ' + e); process.exit(1); });
