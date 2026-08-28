import { escapeHtml } from './safe-html.js';

const form = document.querySelector('#household-form');
const childrenList = document.querySelector('#children-list');
const resultContent = document.querySelector('#result-content');
const emptyState = document.querySelector('#empty-state');
const statusEl = document.querySelector('#webmcp-status');
const outputEl = document.querySelector('#tool-output');
const toolButtons = document.querySelector('#tool-buttons');
const passportPanel = document.querySelector('#passport-panel');
const savePassportButton = document.querySelector('#save-passport');
const forgetPassportButton = document.querySelector('#forget-passport');
const savedStatus = document.querySelector('#saved-status');
const formError = document.querySelector('#form-error');
const STORAGE_KEY = 'benefit-bridge-passport-v02';
const MAX_CHILDREN = 12;
let latestResult = null;
let childCounter = 0;
let preparedEvidence = new Set();
const traceStore = new Map();
const localTools = new Map();

function showFormError(message = '') {
  if (!formError) return;
  formError.textContent = message;
  formError.classList.toggle('hidden', !message);
}

function addChild(age = 8) {
  if (childrenList.querySelectorAll('.child-row').length >= MAX_CHILDREN) {
    showFormError(`Dieser Pilot unterstützt bis zu ${MAX_CHILDREN} Kinder pro Haushalt.`);
    return;
  }
  childCounter += 1;
  const row = document.createElement('div');
  row.className = 'child-row';
  row.dataset.child = String(childCounter);

  const label = document.createElement('label');
  label.append('Alter ');
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '30';
  input.value = String(Math.max(0, Math.min(30, Number(age) || 0)));
  input.setAttribute('aria-label', 'Alter des Kindes');
  label.appendChild(input);

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'remove-child';
  remove.setAttribute('aria-label', 'Kind entfernen');
  remove.textContent = '×';
  remove.addEventListener('click', () => { row.remove(); showFormError(''); });

  row.append(label, remove);
  childrenList.appendChild(row);
}

function householdFromForm() {
  const singleParent = form.elements.householdType.value === 'single';
  return {
    adults: singleParent ? 1 : 2,
    singleParent,
    children: [...childrenList.querySelectorAll('input')].map((input) => ({ age: Number(input.value) })),
    monthlyGrossIncome: Number(document.querySelector('#income').value),
    warmRent: Number(document.querySelector('#rent').value),
    receivesKindergeld: document.querySelector('#kindergeld').checked === true,
    city: 'Berlin'
  };
}

async function evaluate(household = householdFromForm()) {
  showFormError('');
  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ household })
  });
  const result = await response.json().catch(() => ({ ok: false, error: 'Ungültige Serverantwort.' }));
  if (!response.ok || !result.ok) throw new Error(result.errors?.join(' ') || result.error || 'Prüfung fehlgeschlagen.');
  latestResult = result;
  traceStore.set(result.traceId, result);
  renderResult(result);
  renderPassport(result);
  window.dispatchEvent(new CustomEvent('benefitbridge:result', { detail: result }));
  return result;
}

function signalLabel(status) {
  return ({
    known: 'bekannt',
    potential: 'prüfen',
    check_officially: 'offiziell prüfen',
    not_prioritised: 'geringer Hinweis',
    unlikely_from_demo_inputs: 'eher unwahrscheinlich',
    check: 'prüfen',
    conditional_unlock: 'wenn bewilligt',
    check_if_awarded: 'danach prüfen'
  })[status] || status;
}

function renderResult(result) {
  emptyState.classList.add('hidden');
  resultContent.classList.remove('hidden');
  document.querySelector('#trace-badge').textContent = result.traceId;
  document.querySelector('#summary-headline').textContent = result.summary.headline;
  document.querySelector('#summary-boundary').textContent = result.boundary;

  document.querySelector('#benefit-cards').innerHTML = result.benefits.map((b) => {
    const amount = b.monthlyAmount != null
      ? `€${Number(b.monthlyAmount)} <small>/ Monat</small>`
      : b.annualAnchor ? `€${Number(b.annualAnchor)} <small>/ Jahr (Richtwert)</small>` : '—';
    return `<article class="benefit-card ${b.id === 'but' ? 'downstream-card' : ''}">
      <div class="benefit-top"><h4>${escapeHtml(b.title)}</h4><span class="signal ${escapeHtml(b.status)}">${escapeHtml(signalLabel(b.status))}</span></div>
      <div class="benefit-amount">${amount}</div>
      <p>${escapeHtml(b.note)}</p>
      <a class="source-link" href="${escapeHtml(b.source.url)}" target="_blank" rel="noreferrer">Offizielle Quelle ↗</a>
    </article>`;
  }).join('');

  document.querySelector('#evidence-list').innerHTML = result.missingEvidence.map((entry) => `
    <div class="stack-item"><strong>${escapeHtml(entry.label)}</strong><p>${escapeHtml(entry.reason)}</p></div>`).join('') || '<div class="stack-item"><p>Für diesen Check wurden keine weiteren Unterlagen markiert.</p></div>';

  document.querySelector('#next-steps').innerHTML = result.nextSteps.map((entry) => `
    <div class="stack-item"><strong>${Number(entry.priority)}. ${escapeHtml(entry.title)}</strong><p>${escapeHtml(entry.why)}</p>${entry.url ? `<a href="${escapeHtml(entry.url)}" target="_blank" rel="noreferrer">Offiziellen Dienst öffnen ↗</a>` : ''}</div>`).join('');

  document.querySelector('#trace-list').innerHTML = result.trace.map((entry, index) => `
    <div class="trace-step"><span>${index + 1}</span><div><strong>${escapeHtml(entry.step)}</strong><p>${escapeHtml(entry.outcome)}</p></div></div>`).join('');
}

function evidenceState(item) {
  if (item.status === 'claim_available') return 'Angabe vorhanden';
  return preparedEvidence.has(item.id) ? 'lokal vorbereitet' : 'nicht vorbereitet';
}

function serviceName(id) {
  return ({ kiz: 'Kinderzuschlag', wohngeld: 'Wohngeld', but: 'Bildung & Teilhabe' })[id] || id;
}

function shortEvidence(id) {
  return ({
    child_household: 'Haushalt',
    income_proof: 'Einkommen',
    housing_proof: 'Miete/Wohnen',
    rent_payment_proof: 'Mietzahlungen',
    benefit_notice: 'Bescheid'
  })[id] || id;
}

function renderPassport(result) {
  passportPanel.classList.remove('hidden');
  const passport = result.passport;
  document.querySelector('#passport-id').textContent = passport.passportId;
  document.querySelector('#claim-count').textContent = passport.reuseSummary.claimCount;
  document.querySelector('#evidence-count').textContent = passport.reuseSummary.evidenceCategories;
  document.querySelector('#reuse-count').textContent = `${passport.reuseSummary.multiServiceEvidenceCategories} Arten`;

  document.querySelector('#passport-claims').innerHTML = passport.claims.map((claim) => `
    <div class="claim-item"><span class="claim-dot"></span><div><small>${escapeHtml(claim.label)}</small><strong>${escapeHtml(claim.value)}</strong></div><em>Ihre Angabe</em></div>`).join('');

  document.querySelector('#passport-evidence').innerHTML = passport.evidence.map((item) => {
    const inherent = item.status === 'claim_available';
    const checked = inherent || preparedEvidence.has(item.id);
    return `<label class="evidence-item ${checked ? 'ready' : ''}">
      <input type="checkbox" data-evidence="${escapeHtml(item.id)}" ${checked ? 'checked' : ''} ${inherent ? 'disabled' : ''}>
      <span class="evidence-check">${checked ? '✓' : ''}</span>
      <span class="evidence-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.description)}</small><em>${item.services.map(serviceName).map(escapeHtml).join(' · ')}</em></span>
      <span class="evidence-state">${inherent ? 'Angabe' : checked ? 'vorbereitet' : 'fehlt'}</span>
    </label>`;
  }).join('');

  document.querySelectorAll('[data-evidence]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) preparedEvidence.add(input.dataset.evidence); else preparedEvidence.delete(input.dataset.evidence);
    renderPassport(latestResult);
    window.dispatchEvent(new CustomEvent('benefitbridge:evidence-changed', { detail: [...preparedEvidence] }));
  }));

  document.querySelector('#service-readiness').innerHTML = passport.serviceReadiness.map((service) => {
    const required = service.required;
    const ready = required.filter((id) => passport.evidence.find((e) => e.id === id)?.status === 'claim_available' || preparedEvidence.has(id));
    const percent = Math.round((ready.length / required.length) * 100);
    return `<div class="readiness-card">
      <div class="readiness-head"><strong>${escapeHtml(serviceName(service.service))}</strong><span>${ready.length}/${required.length} bereit</span></div>
      <div class="progress"><i style="width:${percent}%"></i></div>
      <div class="reuse-chips">${required.map((id) => `<span class="${ready.includes(id) ? 'ready' : ''}">${escapeHtml(shortEvidence(id))}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function compactResult(result) {
  return {
    traceId: result.traceId,
    policyVersion: result.policyVersion,
    headline: result.summary.headline,
    benefits: result.benefits.map(({ id, status, monthlyAmount, annualAnchor, amountKind, note, source }) => ({ id, status, monthlyAmount, annualAnchor, amountKind, note, source: source.url })),
    passportId: result.passport.passportId,
    boundary: result.boundary
  };
}

async function ensureResult(input = {}) {
  if (input?.traceId && traceStore.has(input.traceId)) return traceStore.get(input.traceId);
  if (input?.household) return evaluate(input.household);
  if (latestResult) return latestResult;
  return evaluate();
}

function passportWithLocalState(result) {
  if (!result) return null;
  return {
    ...result.passport,
    evidence: result.passport.evidence.map((item) => ({ ...item, localPreparationStatus: evidenceState(item) })),
    localPreparedEvidence: [...preparedEvidence]
  };
}

function applicationPlan(result, service) {
  const readiness = result.passport.serviceReadiness.find((entry) => entry.service === service);
  if (!readiness) return { error: `Unsupported service: ${service}` };
  const prepared = readiness.required.filter((id) => result.passport.evidence.find((e) => e.id === id)?.status === 'claim_available' || preparedEvidence.has(id));
  return {
    traceId: result.traceId,
    passportId: result.passport.passportId,
    service,
    serviceLabel: serviceName(service),
    requiredEvidence: readiness.required,
    prepared,
    stillNeeded: readiness.required.filter((id) => !prepared.includes(id)),
    readyPercent: Math.round((prepared.length / readiness.required.length) * 100),
    requiresHumanAction: true,
    boundary: 'Preparation only. This tool cannot submit, sign, or assert an authority decision.'
  };
}

const toolDefinitions = [
  {
    name: 'check_eligibility', title: 'Check family-benefit pathways',
    description: 'Check a Berlin household against preliminary family-benefit gates. Orientation only: returns sources and uncertainty, never a legal entitlement.',
    inputSchema: { type: 'object', properties: { household: { type: 'object', description: 'Household with adults, children ages, monthlyGrossIncome, warmRent, receivesKindergeld and city=Berlin.' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ household }) => compactResult(await evaluate(household))
  },
  {
    name: 'calculate_support', title: 'Calculate anchored support amounts',
    description: 'Return only amounts justified from pinned 2026 anchors, separating known amounts, maximum potentials and official-check-only values.',
    inputSchema: { type: 'object', properties: { household: { type: 'object' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ household }) => { const r = await evaluate(household); return { traceId: r.traceId, summary: r.summary, amounts: r.benefits.map(({ id, monthlyAmount, annualAnchor, amountKind, confidence }) => ({ id, monthlyAmount, annualAnchor, amountKind, confidence })), boundary: r.boundary }; }
  },
  {
    name: 'list_missing_evidence', title: 'List evidence to prepare',
    description: 'List evidence categories for the latest or supplied evaluation while preserving claims versus documentary evidence.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' }, household: { type: 'object' } }, additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async (input = {}) => { const r = await ensureResult(input); return { traceId: r.traceId, missingEvidence: r.missingEvidence.filter((entry) => !preparedEvidence.has(entry.id)), locallyPrepared: [...preparedEvidence], boundary: r.boundary }; }
  },
  {
    name: 'explain_result', title: 'Explain a Public Service Passport result',
    description: 'Explain why a result was produced using its deterministic trace and source anchors.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ traceId }) => { const r = traceStore.get(traceId); if (!r) return { error: 'Trace not found in this browser session.' }; return { traceId, headline: r.summary.headline, explanation: r.trace, sources: r.benefits.map((b) => ({ benefit: b.title, url: b.source.url, fact: b.source.fact })), boundary: r.boundary }; }
  },
  {
    name: 'prepare_next_steps', title: 'Prepare safe next steps',
    description: 'Return ordered human-reviewable next actions and official service links. Cannot submit an application or act on the user’s behalf.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ traceId }) => { const r = traceStore.get(traceId); if (!r) return { error: 'Trace not found in this browser session.' }; return { traceId, nextSteps: r.nextSteps, requiresHumanAction: true, boundary: r.boundary }; }
  },
  {
    name: 'replay_case', title: 'Replay the evaluation trace',
    description: 'Replay the exact rule trace and derived passport for a trace ID.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ traceId }) => { const r = traceStore.get(traceId); if (!r) return { error: 'Trace not found in this browser session.' }; return { traceId, policyVersion: r.policyVersion, household: r.household, trace: r.trace, passport: passportWithLocalState(r), result: compactResult(r) }; }
  },
  {
    name: 'derive_benefit_passport', title: 'Derive a reusable Benefit Passport',
    description: 'Derive structured self-attested claims, evidence categories and cross-service reuse from a household snapshot. Does not persist or verify documents.',
    inputSchema: { type: 'object', properties: { household: { type: 'object' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async ({ household }) => passportWithLocalState(await evaluate(household))
  },
  {
    name: 'get_passport_status', title: 'Inspect current Benefit Passport readiness',
    description: 'Read the latest passport plus human-marked local evidence readiness. Read only; does not mark evidence as verified.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async (input = {}) => passportWithLocalState(await ensureResult(input))
  },
  {
    name: 'plan_application', title: 'Plan one application from the passport',
    description: 'Build an evidence preparation plan for KiZ, Wohngeld or Bildung & Teilhabe. Never submits or signs anything.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' }, service: { type: 'string', enum: ['kiz', 'wohngeld', 'but'] } }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true }, execute: async (input = {}) => applicationPlan(await ensureResult(input), input.service)
  }
];

function installTestingShim() {
  if (document.modelContext) return false;
  const registry = new Map();
  Object.defineProperty(document, 'modelContext', { configurable: true, value: {
    async registerTool(definition, options = {}) {
      registry.set(definition.name, definition);
      options.signal?.addEventListener('abort', () => registry.delete(definition.name), { once: true });
    },
    async getTools() { return [...registry.values()].map(({ execute, ...rest }) => rest); },
    async executeTool(tool, inputJson) {
      const definition = registry.get(tool.name || tool);
      if (!definition) throw new Error('Tool not found');
      const input = typeof inputJson === 'string' ? JSON.parse(inputJson) : inputJson;
      return definition.execute(input || {});
    }
  }});
  return true;
}

async function registerWebMCP() {
  const shimmed = installTestingShim();
  const controller = new AbortController();
  for (const definition of toolDefinitions) {
    localTools.set(definition.name, definition);
    await document.modelContext.registerTool(definition, { signal: controller.signal });
  }
  statusEl?.classList.add('ready');
  if (statusEl) statusEl.innerHTML = `<span class="status-dot"></span>${shimmed ? 'WebMCP Testmodus · 9 Tools' : 'WebMCP nativ · 9 Tools'}`;
  renderToolButtons();
  return controller;
}

function demoArgs(tool) {
  if (['check_eligibility', 'calculate_support', 'derive_benefit_passport'].includes(tool.name)) return { household: householdFromForm() };
  if (tool.name === 'plan_application') return { traceId: latestResult?.traceId, service: 'kiz' };
  return { traceId: latestResult?.traceId };
}

function renderToolButtons() {
  if (!toolButtons) return;
  toolButtons.innerHTML = [...localTools.values()].map((tool) => `<button class="tool-button" data-tool="${escapeHtml(tool.name)}"><code>${escapeHtml(tool.name)}</code><span>testen →</span></button>`).join('');
  toolButtons.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
    const tool = localTools.get(button.dataset.tool);
    if (!latestResult && !['check_eligibility', 'calculate_support', 'derive_benefit_passport'].includes(tool.name)) {
      outputEl.textContent = 'Bitte zuerst einen Leistungs-Check durchführen.';
      return;
    }
    outputEl.textContent = 'Wird ausgeführt…';
    try { outputEl.textContent = JSON.stringify(await tool.execute(demoArgs(tool)), null, 2); }
    catch (error) { outputEl.textContent = `Fehler: ${error.message}`; }
  }));
}

function savePassport() {
  if (!latestResult) return;
  const payload = { savedAt: new Date().toISOString(), household: latestResult.household, passportId: latestResult.passport.passportId, preparedEvidence: [...preparedEvidence] };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateSavedStatus(payload);
    savePassportButton.textContent = 'Lokal gespeichert ✓';
  } catch {
    showFormError('Die lokale Speicherung ist in diesem Browser nicht verfügbar.');
  }
}

function forgetPassport() {
  localStorage.removeItem(STORAGE_KEY);
  preparedEvidence = new Set();
  savedStatus.textContent = 'Nicht gespeichert';
  forgetPassportButton.classList.add('hidden');
  savePassportButton.textContent = 'Nur in diesem Browser speichern';
  if (latestResult) renderPassport(latestResult);
}

function updateSavedStatus(saved) {
  savedStatus.textContent = `Lokal gespeichert · ${saved.passportId}`;
  forgetPassportButton.classList.remove('hidden');
}

async function restoreSavedPassport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw || raw.length > 20000) return;
    const saved = JSON.parse(raw);
    if (!saved?.household || typeof saved.household !== 'object') return;
    const safePrepared = Array.isArray(saved.preparedEvidence)
      ? saved.preparedEvidence.filter((id) => typeof id === 'string' && /^[a-z_]{1,64}$/.test(id)).slice(0, 20)
      : [];
    preparedEvidence = new Set(safePrepared);
    updateSavedStatus(saved);
    document.querySelector('input[name="householdType"][value="single"]').checked = saved.household.singleParent === true;
    document.querySelector('input[name="householdType"][value="couple"]').checked = saved.household.singleParent !== true;
    document.querySelector('#income').value = Number(saved.household.monthlyGrossIncome) || 0;
    document.querySelector('#rent').value = Number(saved.household.warmRent) || 0;
    document.querySelector('#kindergeld').checked = saved.household.receivesKindergeld === true;
    childrenList.innerHTML = '';
    childCounter = 0;
    (Array.isArray(saved.household.children) ? saved.household.children : []).slice(0, MAX_CHILDREN).forEach((child) => addChild(child.age));
    if (!childrenList.children.length) addChild(7);
    await evaluate(saved.household);
    savePassportButton.textContent = 'Lokal gespeichert ✓';
  } catch (error) {
    console.warn('Lokaler Passport konnte nicht wiederhergestellt werden', error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#evaluate-button');
  button.disabled = true;
  button.firstElementChild.textContent = 'Prüfe…';
  try { await evaluate(); }
  catch (error) { showFormError(error.message); }
  finally { button.disabled = false; button.firstElementChild.textContent = 'Unterstützung prüfen'; }
});

document.querySelector('#add-child').addEventListener('click', () => addChild(6));
document.querySelector('#load-demo').addEventListener('click', () => {
  showFormError('');
  document.querySelector('input[name="householdType"][value="single"]').checked = true;
  document.querySelector('#income').value = 2000;
  document.querySelector('#rent').value = 1100;
  document.querySelector('#kindergeld').checked = true;
  childrenList.innerHTML = '';
  childCounter = 0;
  addChild(7);
  addChild(12);
});
savePassportButton.addEventListener('click', savePassport);
forgetPassportButton.addEventListener('click', forgetPassport);

addChild(7);
addChild(12);
registerWebMCP().then(restoreSavedPassport).catch((error) => {
  if (statusEl) statusEl.textContent = `WebMCP-Registrierung fehlgeschlagen: ${error.message}`;
  console.error(error);
});
