// Watchfloor push service: stores browser push subscriptions and sends a notification when a refresh
// adds or escalates a severe (4) or critical (5) item. Reads data/history.json from the site folder.
const http = require('http'), fs = require('fs'), path = require('path'), webpush = require('web-push');
const PORT = Number(process.env.PORT) || 8791;
const DATA = process.env.DATA_DIR || '/data', SITE = process.env.SITE_DIR || '/site';
const SUBJECT = process.env.VAPID_SUBJECT || 'https://watchfloor.duckdns.org';
const ORIGIN = process.env.SITE_URL || 'https://watchfloor.duckdns.org';
const ANY = process.env.ALLOW_ANY_ENDPOINT === '1';
const HOSTS = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)$/;
const rd = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8')); } catch (e) { return d; } };
const wr = (f, o) => { const p = path.join(DATA, f); fs.writeFileSync(p + '.tmp', JSON.stringify(o)); fs.renameSync(p + '.tmp', p); };
fs.mkdirSync(DATA, { recursive: true });
let vapid = rd('vapid.json', null);
if (!vapid) { vapid = webpush.generateVAPIDKeys(); wr('vapid.json', vapid); console.log('Generated new VAPID keys'); }
webpush.setVapidDetails(SUBJECT, vapid.publicKey, vapid.privateKey);
let subs = rd('subs.json', {});            // endpoint -> subscription
let state = rd('state.json', { sent: null });

const hits = {}; // simple per-ip rate limit
const limited = ip => { const m = Math.floor(Date.now() / 60000), h = hits[ip] || (hits[ip] = { m, n: 0 }); if (h.m !== m) { h.m = m; h.n = 0; } return ++h.n > 20; };
const send = (res, code, o) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(o)); };
const body = req => new Promise((ok, no) => { let b = ''; req.on('data', c => { b += c; if (b.length > 4096) { req.destroy(); no(new Error('big')); } }); req.on('end', () => ok(b)); req.on('error', no); });
const validSub = s => {
  if (!s || typeof s.endpoint !== 'string' || !s.keys || typeof s.keys.p256dh !== 'string' || typeof s.keys.auth !== 'string') return false;
  let u; try { u = new URL(s.endpoint); } catch (e) { return false; }
  if (!ANY && (u.protocol !== 'https:' || !HOSTS.test(u.hostname))) return false;
  return s.endpoint.length < 600;
};

const server = http.createServer(async (req, res) => {
  const p = (req.url || '').split('?')[0].replace(/^\/push/, '') || '/';
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  try {
    if (req.method === 'GET' && p === '/key') return send(res, 200, { key: vapid.publicKey });
    if (req.method === 'GET' && p === '/health') return send(res, 200, { ok: true, subscribers: Object.keys(subs).length });
    if (req.method === 'POST' && (p === '/subscribe' || p === '/unsubscribe')) {
      if (limited(ip)) return send(res, 429, { error: 'slow down' });
      const s = JSON.parse(await body(req));
      if (!validSub(s)) return send(res, 400, { error: 'bad subscription' });
      if (p === '/subscribe') { if (Object.keys(subs).length >= 2000) return send(res, 503, { error: 'full' }); subs[s.endpoint] = { endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, at: Date.now() }; }
      else delete subs[s.endpoint];
      wr('subs.json', subs); return send(res, 200, { ok: true });
    }
    send(res, 404, { error: 'not found' });
  } catch (e) { send(res, 400, { error: 'bad request' }); }
});

async function notify(payload) {
  const text = JSON.stringify(payload); let ok = 0, gone = 0;
  for (const ep of Object.keys(subs)) {
    try { await webpush.sendNotification(subs[ep], text, { TTL: 6 * 3600, urgency: 'high' }); ok++; }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) { delete subs[ep]; gone++; } else console.log('Send failed (' + (e.statusCode || e.code || 'error') + '): ' + String(e.message || '').slice(0, 100)); }
  }
  if (gone) wr('subs.json', subs);
  console.log('Sent to ' + ok + ' subscribers, removed ' + gone + ' expired');
}
async function check() {
  let h; try { h = JSON.parse(fs.readFileSync(path.join(SITE, 'data/history.json'), 'utf8')); } catch (e) { return; }
  const sn = (h.snaps || []).slice().sort((a, b) => Date.parse(a.t) - Date.parse(b.t)), names = h.names || {};
  if (!sn.length) return;
  const latest = sn[sn.length - 1].t;
  if (!state.sent) { state.sent = latest; wr('state.json', state); return; }   // first start: do not alert on old data
  const fresh = sn.filter(s => Date.parse(s.t) > Date.parse(state.sent)); if (!fresh.length) return;
  const found = [];
  for (let i = 0; i < sn.length; i++) {
    if (Date.parse(sn[i].t) <= Date.parse(state.sent) || !i) continue;
    const a = sn[i - 1].v, b = sn[i].v;
    Object.keys(b).forEach(k => { if (b[k] >= 4 && (!(k in a) || b[k] > a[k])) found.push({ k, sev: b[k], isNew: !(k in a) }); });
  }
  state.sent = latest; wr('state.json', state);
  if (!found.length || !Object.keys(subs).length) return;
  const uniq = {}; found.forEach(f => { uniq[f.k] = f; });
  const list = Object.values(uniq).sort((x, y) => y.sev - x.sev);
  const label = f => (names[f.k] || f.k.split('/')[1]) + (f.isNew ? ' (new' : ' (escalated') + ', ' + (f.sev >= 5 ? 'critical' : 'severe') + ')';
  await notify({ title: 'Watchfloor: ' + list.length + ' severe update' + (list.length > 1 ? 's' : ''), body: list.slice(0, 3).map(label).join('; ') + (list.length > 3 ? '; +' + (list.length - 3) + ' more' : ''), url: list.length === 1 ? ORIGIN + '/#i=' + list[0].k : ORIGIN + '/' });
}
setInterval(() => check().catch(e => console.log('check failed: ' + e.message)), 60000);
server.listen(PORT, () => console.log('Watchfloor push on ' + PORT + ', ' + Object.keys(subs).length + ' subscribers'));
