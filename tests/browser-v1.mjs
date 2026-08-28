import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.PSP_BASE_URL || 'http://127.0.0.1:8888';
const GOLDEN_HEADLINE = '€518/Monat bekannt + bis zu €594/Monat zusätzlich prüfen';
const OFFICIAL_HOSTS = new Set(['www.arbeitsagentur.de', 'service.berlin.de', 'www.bmas.de']);

async function text(page, selector) {
  return (await page.locator(selector).innerText()).trim();
}

async function runViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
  });

  try {
    const response = await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle' });
    assert.equal(response?.status(), 200, `${name}: root must respond 200`);
    assert.match(await page.title(), /Public Service Passport v1\.0/);
    assert.equal(await page.locator('#v1-proof').evaluate((element) => element.classList.contains('hidden')), true, `${name}: proof should wait for a case`);
    assert.match(await text(page, 'body'), /Keine automatische Antragstellung/);
    assert.match(await text(page, 'body'), /v1\.0 · Public Pilot/);

    await page.locator('[data-case="single-parent-main"]').click();
    await page.locator('#v1-result:not(.hidden)').waitFor();
    await page.locator('#v1-proof:not(.hidden)').waitFor();

    assert.equal(await text(page, '#v1-headline'), GOLDEN_HEADLINE, `${name}: golden result changed`);
    assert.match(await text(page, '#v1-proof-state'), /proof-ready/);
    assert.match(await text(page, '#v1-proof'), /Ihre aktuellen Werte sind selbst angegeben/);
    assert.match(await text(page, '#v1-proof-private'), /exact income/i);
    assert.match(await text(page, '.rail-proof'), /OpenProof run 33167627520/);
    assert.match(await text(page, '.rail-proof'), /Infrastruktur-Evidence, nicht ein Nachweis über Sie/);

    const officialLinks = await page.locator('#v1-result a[target="_blank"]').evaluateAll((links) => links.map((link) => link.href));
    assert(officialLinks.length >= 3, `${name}: expected several official next-step/source links`);
    for (const href of officialLinks) {
      const host = new URL(href).host;
      assert(OFFICIAL_HOSTS.has(host), `${name}: non-official result link host ${host}`);
    }

    assert.equal(await page.evaluate(() => localStorage.getItem('public-service-passport-v1-household')), null, `${name}: storage must start empty`);
    await page.locator('#v1-save').click();
    assert.notEqual(await page.evaluate(() => localStorage.getItem('public-service-passport-v1-household')), null, `${name}: explicit save should persist locally`);
    await page.locator('#v1-forget').click();
    assert.equal(await page.evaluate(() => localStorage.getItem('public-service-passport-v1-household')), null, `${name}: forget should delete local state`);

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth
    }));
    assert(overflow.scrollWidth <= overflow.clientWidth + 1, `${name}: horizontal overflow ${overflow.scrollWidth} > ${overflow.clientWidth}`);

    const ctaBox = await page.locator('#v1-submit').boundingBox();
    assert(ctaBox && ctaBox.width >= 44 && ctaBox.height >= 44, `${name}: primary CTA must remain touch-usable`);
    assert.deepEqual(runtimeErrors, [], `${name}: browser runtime errors: ${runtimeErrors.join(' | ')}`);

    console.log(`✓ ${name}: golden case + proof readiness + privacy + storage + official links + responsive overflow`);
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await runViewport(browser, 'desktop-1440', { width: 1440, height: 900 });
  await runViewport(browser, 'mobile-390', { width: 390, height: 844 });
  console.log('Public Service Passport v1 browser QA: PASS');
} finally {
  await browser.close();
}
