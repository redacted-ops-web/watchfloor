// Test: read Google Maps "LIVE" busyness. Run: node busy-test.js
const { chromium } = require('playwright-core');
const Q = 'Extreme Pizza 1419 S Fern St Arlington VA';
async function tryMode(headless, ua) {
  const browser = await chromium.launch({ channel: 'chrome', headless, args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext(Object.assign({ locale: 'en-US', viewport: { width: 1280, height: 900 } }, ua ? { userAgent: ua } : {}));
  const page = await ctx.newPage();
  await page.goto('https://www.google.com/maps/search/' + encodeURIComponent(Q) + '?hl=en', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(5000);
  const text = await page.evaluate(() => document.body.innerText);
  const i = text.indexOf('Popular times');
  console.log('headless=' + headless + ' ua=' + (ua ? 'custom' : 'default'));
  console.log('  limited view: ' + /limited view/i.test(text) + ' | has Popular times: ' + (i >= 0) + ' | has LIVE: ' + /LIVE/.test(text));
  if (i >= 0) console.log('  snippet: ' + text.slice(i, i + 120).replace(/\n+/g, ' | '));
  await browser.close();
}
(async () => {
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
  await tryMode(true);
  await tryMode(true, UA);
  await tryMode(false, UA);
})().catch(e => console.log('error: ' + e.message));
