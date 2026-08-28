import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html = fs.readFileSync(new URL('../public/v1.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../public/v1.js', import.meta.url), 'utf8');
const handoffJs = fs.readFileSync(new URL('../public/v1-handoff.js', import.meta.url), 'utf8');
const privacy = fs.readFileSync(new URL('../public/privacy.html', import.meta.url), 'utf8');
const config = fs.readFileSync(new URL('../netlify.toml', import.meta.url), 'utf8');

test('v1 public page identifies itself as a bounded RC1 Public Test', () => {
  assert.ok(html.includes('v1.0 RC1 · Public Test'));
  assert.ok(html.includes('Kein Anspruchsbescheid'));
  assert.ok(html.includes('Keine automatische Antragstellung'));
  assert.ok(html.includes('Ihre aktuellen Werte sind selbst angegeben'));
});

test('v1 includes all five golden citizen examples', () => {
  for (const id of ['single-parent-main', 'single-parent-floor', 'couple-below', 'kindergeld-unknown', 'older-child']) {
    assert.ok(html.includes(`data-case="${id}"`));
    assert.ok(js.includes(`'${id}'`));
  }
});

test('v1 exposes the proof privacy distinction without claiming current visitor verification', () => {
  assert.ok(html.includes('Was könnten Sie beweisen, ohne das ganze Dokument zu teilen?'));
  assert.ok(html.includes('offiziellen/EUDI-kompatiblen Aussteller'));
  assert.ok(html.includes('Das ist Infrastruktur-Evidence, nicht ein Nachweis über Sie'));
  assert.ok(js.includes("state.textContent = 'nachweisbereit · Aussteller fehlt'"));
});

test('v1 says explicitly that even a verified proof is not an entitlement decision', () => {
  assert.ok(html.includes('Auch ein später kryptografisch verifizierter Proof'));
  assert.ok(html.includes('kein Leistungsbescheid'));
});

test('v1 labels amount semantics instead of forcing citizens to infer them', () => {
  assert.ok(js.includes("deterministic_anchor: 'bekannter Richtwert'"));
  assert.ok(js.includes("maximum_potential_not_entitlement: 'Höchstbetrag · kein Anspruch'"));
  assert.ok(js.includes("not_calculated: 'bewusst nicht berechnet'"));
});

test('v1 keeps ordinary storage explicitly user-triggered', () => {
  assert.ok(html.includes('In diesem Browser speichern'));
  assert.ok(js.includes("document.querySelector('#v1-save').addEventListener('click', saveLocal)"));
  assert.equal(js.includes('setItem(STORAGE_KEY') && !js.includes('function saveLocal'), false);
});

test('authority preview is explicit, local, one-time and described before use', () => {
  assert.ok(html.includes('Diesen Testfall aus Behördensicht ansehen'));
  assert.ok(html.includes('kurz lokal im Browser übergeben'));
  assert.ok(handoffJs.includes('localStorage.setItem(CITIZEN_AUTHORITY_HANDOFF_STORAGE_KEY'));
  assert.ok(handoffJs.includes("window.location.assign('/authority.html?source=citizen')"));
});

test('v1 has no consequential authority tool or submission identifier', () => {
  assert.equal(/submit_application|sign_application|authenticate_as_user|upload_to_authority/.test(js + handoffJs), false);
  assert.ok(js.includes('not submitted to any authority'));
});

test('privacy page makes public-test data flow visible', () => {
  assert.ok(html.includes('/privacy.html'));
  assert.ok(privacy.includes('Keine Identität nötig'));
  assert.ok(privacy.includes('Es erfolgt keine Behördenübermittlung'));
  assert.ok(privacy.includes('Keine privaten Haushaltsdaten werden in dieser Public-Test-Version auf Midnight geschrieben'));
});

test('v1 keeps scripts external for CSP compatibility', () => {
  assert.equal(/<script(?![^>]*src=)/i.test(html), false);
  assert.ok(html.includes('src="/v1.js"'));
  assert.ok(html.includes('src="/v1-handoff.js"'));
});

test('Netlify root serves the v1 citizen experience and preserves security headers', () => {
  assert.ok(config.includes('to = "/v1.html"'));
  assert.ok(config.includes('Content-Security-Policy'));
  assert.ok(config.includes("object-src 'none'"));
  assert.ok(config.includes("frame-ancestors 'none'"));
});
