// INTSUM space weather collector. Run from the repo root: node server/space.js
// Reads NOAA SWPC public JSON (no key needed), writes data/space.json. Each sub-feed can fail on its own.
// SWPC changed several JSON layouts in March 2026 (header-row arrays became key-value objects); both are handled.
const fs = require('fs');
const BASE = 'https://services.swpc.noaa.gov', OUT = 'data/space.json';
const num = v => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) ? n : null; };

function normRows(a) {
  if (!Array.isArray(a) || !a.length) return [];
  if (Array.isArray(a[0])) { const h = a[0].map(String); return a.slice(1).map(r => Object.fromEntries(h.map((k, i) => [k, r[i]]))); }
  return a.filter(x => x && typeof x === 'object');
}
function parseKp(raw) {
  const rows = normRows(raw); if (!rows.length) return null;
  const kpOf = o => { const k = Object.keys(o).find(x => /^kp(_index)?$/i.test(x)); return k ? num(o[k]) : null; };
  const vals = rows.map(r => ({ t: r.time_tag || r.timeTag || null, kp: kpOf(r) })).filter(r => r.kp !== null);
  if (!vals.length) return null;
  const last = vals[vals.length - 1], recent = vals.slice(-8);
  return { kp: last.kp, kpTime: last.t, kpMax24: Math.max.apply(null, recent.map(r => r.kp)) };
}
function parseScales(s) {
  if (!s || typeof s !== 'object') return null;
  const lvl = (d, k) => (d && d[k] && num(d[k].Scale) !== null) ? num(d[k].Scale) : null;
  const cur = s['0'];
  if (!cur) return null;
  let fG = null;
  ['1', '2', '3'].forEach(k => { const g = lvl(s[k], 'G'); if (g !== null) fG = fG === null ? g : Math.max(fG, g); });
  return { G: lvl(cur, 'G'), S: lvl(cur, 'S'), R: lvl(cur, 'R'), forecastG: fG };
}
function parseAlerts(a, now) {
  if (!Array.isArray(a)) return [];
  const out = [];
  a.forEach(x => {
    if (!x || typeof x.message !== 'string') return;
    const t = Date.parse((x.issue_datetime || '').replace(' ', 'T') + (/Z|[+-]\d\d:?\d\d$/.test(x.issue_datetime || '') ? '' : 'Z'));
    if (!t || now - t > 24 * 3600e3) return;
    const m = x.message.split(/\r?\n/).map(l => l.trim()).find(l => /^(ALERT|WARNING|WATCH|SUMMARY|EXTENDED WARNING|CONTINUED ALERT|CONTINUED WARNING):/i.test(l));
    if (m) out.push({ t: new Date(t).toISOString(), text: m.slice(0, 160) });
  });
  return out.sort((p, q) => q.t.localeCompare(p.t)).slice(0, 4);
}
function parseFlare(a) {
  const rows = Array.isArray(a) ? a.filter(x => x && typeof x === 'object') : [];
  if (!rows.length) return null;
  const r = rows[rows.length - 1], cls = r.max_class || r.current_class || r.class || null;
  return cls ? { cls: String(cls), t: r.max_time || r.begin_time || null } : null;
}
module.exports = { normRows, parseKp, parseScales, parseAlerts, parseFlare };

async function get(p) {
  let err;
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(BASE + p, { headers: { 'User-Agent': 'intsum-dashboard/1.0', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw new Error(p + ' HTTP ' + r.status);
      return await r.json();
    } catch (e) { err = e; await new Promise(res => setTimeout(res, 2500)); }
  }
  throw err;
}
async function main() {
  const now = Date.now(), errors = {}, res = { ok: false, checkedAt: new Date(now).toISOString() };
  const tryit = async (name, path, fn) => { try { const v = fn(await get(path)); if (v) return v; errors[name] = 'unrecognised format'; } catch (e) { errors[name] = String(e.message || e); } return null; };
  const kp = await tryit('kp', '/products/noaa-planetary-k-index.json', parseKp);
  const sc = await tryit('scales', '/products/noaa-scales.json', parseScales);
  const al = await tryit('alerts', '/products/alerts.json', a => parseAlerts(a, now));
  const fl = await tryit('flare', '/json/goes/primary/xray-flares-latest.json', parseFlare);
  Object.assign(res, kp || {}, sc || {}, { alerts: al || [], flare: fl || null, errors });
  res.ok = !!(kp || sc);
  let old = null; try { old = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch (e) { /* none */ }
  if (!res.ok && old) { old.ok = false; old.checkedAt = res.checkedAt; old.errors = errors; res.ok = false; fs.writeFileSync(OUT + '.tmp', JSON.stringify(old)); }
  else fs.writeFileSync(OUT + '.tmp', JSON.stringify(res));
  fs.renameSync(OUT + '.tmp', OUT); fs.chmodSync(OUT, 0o644);
  console.log(res.checkedAt + ' space ' + (res.ok ? 'OK kp=' + res.kp + ' G' + res.G + ' S' + res.S + ' R' + res.R : 'FAIL') + (Object.keys(errors).length ? ' errors=' + JSON.stringify(errors) : ''));
}
if (require.main === module) main().catch(e => { console.error('space failed: ' + e); process.exit(1); });
