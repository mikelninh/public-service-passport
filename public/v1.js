import { escapeHtml } from './safe-html.js';
import { assessFamilyProofReadiness, deriveCitizenRequestDigest } from './openproof-verifier.js';

const STORAGE_KEY = 'public-service-passport-v1-household';
const MAX_UI_CHILDREN = 12;

const GOLDEN_CASES = {
  'single-parent-main': { adults: 1, singleParent: true, children: [{ age: 7 }, { age: 12 }], monthlyGrossIncome: 2000, warmRent: 1100, receivesKindergeld: true, city: 'Berlin' },
  'single-parent-floor': { adults: 1, singleParent: true, children: [{ age: 5 }], monthlyGrossIncome: 600, warmRent: 650, receivesKindergeld: true, city: 'Berlin' },
  'couple-below': { adults: 2, singleParent: false, children: [{ age: 4 }], monthlyGrossIncome: 899, warmRent: 700, receivesKindergeld: true, city: 'Berlin' },
  'kindergeld-unknown': { adults: 1, singleParent: true, children: [{ age: 8 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: false, city: 'Berlin' },
  'older-child': { adults: 1, singleParent: true, children: [{ age: 19 }], monthlyGrossIncome: 1800, warmRent: 900, receivesKindergeld: true, city: 'Berlin' }
};

const form = document.querySelector('#v1-form');
const childrenRoot = document.querySelector('#v1-children');
const errorEl = document.querySelector('#v1-error');
let latestResult = null;
let childSequence = 0;

function setError(message = '') {
  errorEl.textContent = message;
  errorEl.classList.toggle('hidden', !message);
}

function addChild(age = 7) {
  if (childrenRoot.children.length >= MAX_UI_CHILDREN) {
    setError(`In dieser Oberfläche können maximal ${MAX_UI_CHILDREN} Kinder eingegeben werden.`);
    return;
  }
  childSequence += 1;
  const row = document.createElement('div');
  row.className = 'child-row';
  const label = document.createElement('label');
  label.textContent = 'Alter ';
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '30';
  input.value = String(Math.max(0, Math.min(30, Number(age) || 0)));
  input.setAttribute('aria-label', `Alter Kind ${childSequence}`);
  label.appendChild(input);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove';
  remove.textContent = '×';
  remove.setAttribute('aria-label', 'Kind entfernen');
  remove.addEventListener('click', () => row.remove());
  row.append(label, remove);
  childrenRoot.appendChild(row);
}

function householdFromForm() {
  const singleParent = form.elements.householdType.value === 'single';
  return {
    adults: singleParent ? 1 : 2,
    singleParent,
    children: [...childrenRoot.querySelectorAll('input')].map((input) => ({ age: Number(input.value) })),
    monthlyGrossIncome: Number(document.querySelector('#v1-income').value),
    warmRent: Number(document.querySelector('#v1-rent').value),
    receivesKindergeld: document.querySelector('#v1-kindergeld').checked === true,
    city: 'Berlin'
  };
}

function applyHousehold(household) {
  document.querySelector(`input[name="householdType"][value="${household.singleParent ? 'single' : 'couple'}"]`).checked = true;
  document.querySelector('#v1-income').value = Number(household.monthlyGrossIncome) || 0;
  document.querySelector('#v1-rent').value = Number(household.warmRent) || 0;
  document.querySelector('#v1-kindergeld').checked = household.receivesKindergeld === true;
  childrenRoot.innerHTML = '';
  childSequence = 0;
  (Array.isArray(household.children) ? household.children : []).slice(0, MAX_UI_CHILDREN).forEach((child) => addChild(child.age));
  if (!childrenRoot.children.length) addChild(7);
}

async function evaluate(household = householdFromForm()) {
  setError('');
  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ household })
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'Ungültige Serverantwort.' }));
  if (!response.ok || !result.ok) throw new Error(result.errors?.join(' ') || result.error || 'Prüfung fehlgeschlagen.');
  latestResult = result;
  renderResult(result);
  await renderProof(result);
  return result;
}

const statusLabel = (status) => ({
  known: 'bekannt',
  potential: 'prüfen',
  check_officially: 'offiziell prüfen',
  not_prioritised: 'geringer Hinweis',
  unlikely_from_demo_inputs: 'aktuell kein Signal',
  check: 'prüfen',
  conditional_unlock: 'wenn bewilligt',
  check_if_awarded: 'danach prüfen'
})[status] || status;

function amountLabel(benefit) {
  if (benefit.monthlyAmount != null) return `€${Number(benefit.monthlyAmount)} / Monat`;
  if (benefit.annualAnchor != null) return `€${Number(benefit.annualAnchor)} / Jahr`;
  return 'Kein Betrag berechnet';
}

function renderResult(result) {
  document.querySelector('#v1-empty').classList.add('hidden');
  document.querySelector('#v1-result').classList.remove('hidden');
  document.querySelector('#v1-policy').textContent = result.policyVersion;
  document.querySelector('#v1-policy').className = 'state neutral';
  document.querySelector('#v1-headline').textContent = result.summary.headline;
  document.querySelector('#v1-boundary').textContent = result.boundary;

  document.querySelector('#v1-benefits').innerHTML = result.benefits.map((benefit) => `
    <article class="benefit-card">
      <div class="benefit-head"><h3>${escapeHtml(benefit.title)}</h3><span class="signal">${escapeHtml(statusLabel(benefit.status))}</span></div>
      <strong class="amount">${escapeHtml(amountLabel(benefit))}</strong>
      <p>${escapeHtml(benefit.note)}</p>
      <a href="${escapeHtml(benefit.source.url)}" target="_blank" rel="noreferrer">Offizielle Quelle ↗</a>
    </article>`).join('');

  document.querySelector('#v1-evidence').innerHTML = result.missingEvidence.map((entry) => `
    <div class="list-item"><span class="dot"></span><div><strong>${escapeHtml(entry.label)}</strong><p>${escapeHtml(entry.reason)}</p></div></div>`).join('') || '<div class="list-item"><div><strong>Keine weiteren Unterlagen markiert</strong><p>Für diesen Orientierungs-Check ist aktuell nichts zusätzlich hinterlegt.</p></div></div>';

  document.querySelector('#v1-next').innerHTML = result.nextSteps.map((entry) => `
    <div class="list-item"><span class="rank">${Number(entry.priority)}</span><div><strong>${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.why)}</p>${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noreferrer">Offiziellen Dienst öffnen ↗</a>` : ''}</div></div>`).join('');
}

async function renderProof(result) {
  const proofSection = document.querySelector('#v1-proof');
  proofSection.classList.remove('hidden');
  const readiness = assessFamilyProofReadiness(result.household);
  const state = document.querySelector('#v1-proof-state');
  const headline = document.querySelector('#v1-proof-headline');
  const copy = document.querySelector('#v1-proof-copy');

  if (readiness.status === 'NEEDS_OFFICIAL_CREDENTIAL') {
    state.textContent = 'proof-ready · Aussteller fehlt';
    state.className = 'state ready';
    headline.textContent = 'Die privaten Bedingungen lassen sich beschreiben — aber Ihr Fall ist noch nicht verifiziert.';
    copy.textContent = 'Die selbst angegebenen Werte passen zur technischen Demo-Policy. Für einen echten Proof fehlt noch ein offiziell ausgestellter, an Sie gebundener Nachweis.';
  } else if (readiness.status === 'OUTSIDE_DEMO_POLICY') {
    state.textContent = 'außerhalb Demo-Policy';
    state.className = 'state warn';
    headline.textContent = 'Diese OpenProof-Demo-Policy passt nicht zu Ihren aktuellen Angaben.';
    copy.textContent = 'Das sagt nichts über Ihren rechtlichen Anspruch. Es bedeutet nur, dass dieser eine technische Proof-Policy-Pfad nicht erfüllt wäre.';
  } else {
    state.textContent = 'Eingabe prüfen';
    state.className = 'state warn';
    headline.textContent = 'Für diesen Proof-Check fehlen gültige Eingaben.';
    copy.textContent = readiness.boundary;
  }

  document.querySelector('#v1-proof-predicates').innerHTML = readiness.predicates.map((predicate) => `
    <div class="predicate ${predicate.passed ? 'pass' : 'missing'}"><span>${predicate.passed ? '✓' : '○'}</span><div><strong>${escapeHtml(predicate.label)}</strong><small>${predicate.provenance === 'missing_issuer' ? 'offizieller Nachweis fehlt' : 'derzeit nur selbst angegeben'}</small></div></div>`).join('');
  document.querySelector('#v1-proof-shared').innerHTML = readiness.publicProofWouldReveal.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  document.querySelector('#v1-proof-private').innerHTML = readiness.privateValuesNotShared.map((item) => `<li>${escapeHtml(item)}</li>`).join('');

  const digest = await deriveCitizenRequestDigest({ traceId: result.traceId, policyVersion: result.policyVersion, service: 'care-family-precheck' });
  document.querySelector('#v1-request-digest').textContent = `${digest.slice(0, 12)}…${digest.slice(-8)}`;
}

function checklistPayload() {
  if (!latestResult) return null;
  return {
    product: 'Public Service Passport v1.0 Public Pilot',
    exportedAt: new Date().toISOString(),
    policyVersion: latestResult.policyVersion,
    traceId: latestResult.traceId,
    household: latestResult.household,
    summary: latestResult.summary,
    benefits: latestResult.benefits.map(({ id, title, status, monthlyAmount, annualAnchor, amountKind, source }) => ({ id, title, status, monthlyAmount, annualAnchor, amountKind, officialSource: source.url })),
    evidenceToPrepare: latestResult.missingEvidence,
    nextSteps: latestResult.nextSteps,
    boundary: 'LOCAL CITIZEN EXPORT — orientation only; not submitted to any authority and not an entitlement decision.'
  };
}

function downloadChecklist() {
  const payload = checklistPayload();
  if (!payload) return;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `public-service-passport-${payload.traceId}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function refreshLocalControls() {
  let exists = false;
  try { exists = Boolean(localStorage.getItem(STORAGE_KEY)); } catch { exists = false; }
  document.querySelector('#v1-load-local').classList.toggle('hidden', !exists);
  document.querySelector('#v1-forget').classList.toggle('hidden', !exists);
}

function saveLocal() {
  const household = householdFromForm();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: new Date().toISOString(), household }));
    document.querySelector('#v1-save').textContent = 'Lokal gespeichert ✓';
    refreshLocalControls();
  } catch {
    setError('Lokales Speichern ist in diesem Browser nicht verfügbar.');
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 20000) return;
    const parsed = JSON.parse(raw);
    if (!parsed?.household || typeof parsed.household !== 'object') return;
    applyHousehold(parsed.household);
    evaluate(parsed.household).catch((error) => setError(error.message));
  } catch {
    setError('Die lokale Kopie konnte nicht gelesen werden.');
  }
}

function forgetLocal() {
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* no-op */ }
  document.querySelector('#v1-save').textContent = 'In diesem Browser speichern';
  refreshLocalControls();
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#v1-submit');
  button.disabled = true;
  button.firstChild.textContent = 'Prüfe… ';
  try { await evaluate(); }
  catch (error) { setError(error.message); }
  finally { button.disabled = false; button.firstChild.textContent = 'Unterstützung prüfen '; }
});

document.querySelector('#v1-add-child').addEventListener('click', () => addChild(6));
document.querySelector('#v1-save').addEventListener('click', saveLocal);
document.querySelector('#v1-load-local').addEventListener('click', loadLocal);
document.querySelector('#v1-forget').addEventListener('click', forgetLocal);
document.querySelector('#v1-download').addEventListener('click', downloadChecklist);
document.querySelectorAll('[data-case]').forEach((button) => button.addEventListener('click', async () => {
  const household = GOLDEN_CASES[button.dataset.case];
  if (!household) return;
  applyHousehold(household);
  document.querySelectorAll('[data-case]').forEach((entry) => entry.classList.toggle('active', entry === button));
  try {
    await evaluate(household);
    document.querySelector('#check').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) { setError(error.message); }
}));

addChild(7);
addChild(12);
refreshLocalControls();
