// Test 3: persistent profile with Google cookies. Run: node busy-test.js
const { chromium } = require('playwright-core');
const Q = 'Extreme Pizza 1419 S Fern St Arlington VA';
(async () => {
  const ctx = await chromium.launchPersistentContext('C:\\watchfloor\\chrome-profile', {
    channel: 'chrome', headless: false, locale: 'en-US', viewport: { width: 1280, height: 900 },
    args: ['--disable-blink-features=AutomationControlled']
  });
  const page = ctx.pages()[0] || await ctx.newPage();
  await page.goto('https://www.google.com/?hl=en', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  for (const label of ['Reject all', 'Accept all']) {
    const b = page.locator('button:has-text("' + label + '")');
    if (await b.count()) { await b.first().click().catch(() => {}); break; }
  }
  await page.waitForTimeout(1500);
  for (let n = 1; n <= 2; n++) {
    await page.goto('https://www.google.com/maps/search/' + encodeURIComponent(Q) + '?hl=en', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);
    const text = await page.evaluate(() => document.body.innerText);
    const i = text.indexOf('Popular times');
    console.log('visit ' + n + ' | limited view: ' + /limited view/i.test(text) + ' | Popular times: ' + (i >= 0) + ' | LIVE: ' + /LIVE/.test(text));
    if (i >= 0) console.log('  snippet: ' + text.slice(i, i + 120).replace(/\n+/g, ' | '));
  }
  await ctx.close();
})().catch(e => console.log('error: ' + e.message));
