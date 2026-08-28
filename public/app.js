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
const STORAGE_KEY = 'benefit-bridge-passport-v02';
let latestResult = null;
let childCounter = 0;
let preparedEvidence = new Set();
const traceStore = new Map();
const localTools = new Map();

function addChild(age = 8) {
  childCounter += 1;
  const row = document.createElement('div');
  row.className = 'child-row';
  row.dataset.child = String(childCounter);
  row.innerHTML = `<label>Age <input type="number" min="0" max="30" value="${age}" aria-label="Child age"></label><button type="button" class="remove-child" aria-label="Remove child">×</button>`;
  row.querySelector('.remove-child').addEventListener('click', () => row.remove());
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
    receivesKindergeld: document.querySelector('#kindergeld').checked,
    city: 'Berlin'
  };
}

async function evaluate(household = householdFromForm()) {
  const response = await fetch('/api/evaluate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ household })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.errors?.join(' ') || result.error || 'Evaluation failed');
  latestResult = result;
  traceStore.set(result.traceId, result);
  renderResult(result);
  renderPassport(result);
  return result;
}

function signalLabel(status) {
  return ({
    known: 'known', potential: 'worth checking', check_officially: 'official check',
    not_prioritised: 'low signal', unlikely_from_demo_inputs: 'low signal', check: 'check',
    conditional_unlock: 'if awarded', check_if_awarded: 'downstream'
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
      ? `€${b.monthlyAmount} <small>/ month</small>`
      : b.annualAnchor ? `€${b.annualAnchor} <small>/ year anchor</small>` : '—';
    return `<article class="benefit-card ${b.id === 'but' ? 'downstream-card' : ''}">
      <div class="benefit-top"><h4>${b.title}</h4><span class="signal ${b.status}">${signalLabel(b.status)}</span></div>
      <div class="benefit-amount">${amount}</div>
      <p>${b.note}</p>
      <a class="source-link" href="${b.source.url}" target="_blank" rel="noreferrer">Official source ↗</a>
    </article>`;
  }).join('');

  document.querySelector('#evidence-list').innerHTML = result.missingEvidence.map((item) => `
    <div class="stack-item"><strong>${item.label}</strong><p>${item.reason}</p></div>`).join('') || '<div class="stack-item"><p>No additional evidence flagged by this demo.</p></div>';

  document.querySelector('#next-steps').innerHTML = result.nextSteps.map((item) => `
    <div class="stack-item"><strong>${item.priority}. ${item.title}</strong><p>${item.why}</p>${item.url ? `<a href="${item.url}" target="_blank" rel="noreferrer">Open official service ↗</a>` : ''}</div>`).join('');

  document.querySelector('#trace-list').innerHTML = result.trace.map((item, index) => `
    <div class="trace-step"><span>${index + 1}</span><div><strong>${item.step}</strong><p>${item.outcome}</p></div></div>`).join('');
}

function evidenceState(item) {
  if (item.status === 'claim_available') return 'claim available';
  return preparedEvidence.has(item.id) ? 'prepared locally' : 'not prepared';
}

function renderPassport(result) {
  passportPanel.classList.remove('hidden');
  const passport = result.passport;
  document.querySelector('#passport-id').textContent = passport.passportId;
  document.querySelector('#claim-count').textContent = passport.reuseSummary.claimCount;
  document.querySelector('#evidence-count').textContent = passport.reuseSummary.evidenceCategories;
  document.querySelector('#reuse-count').textContent = `${passport.reuseSummary.multiServiceEvidenceCategories} shared`;

  document.querySelector('#passport-claims').innerHTML = passport.claims.map((claim) => `
    <div class="claim-item"><span class="claim-dot"></span><div><small>${claim.label}</small><strong>${claim.value}</strong></div><em>self-attested</em></div>`).join('');

  document.querySelector('#passport-evidence').innerHTML = passport.evidence.map((item) => {
    const inherent = item.status === 'claim_available';
    const checked = inherent || preparedEvidence.has(item.id);
    const disabled = inherent ? 'disabled' : '';
    return `<label class="evidence-item ${checked ? 'ready' : ''}">
      <input type="checkbox" data-evidence="${item.id}" ${checked ? 'checked' : ''} ${disabled}>
      <span class="evidence-check">${checked ? '✓' : ''}</span>
      <span class="evidence-copy"><strong>${item.label}</strong><small>${item.description}</small><em>${item.services.map(serviceName).join(' · ')}</em></span>
      <span class="evidence-state">${inherent ? 'claim' : checked ? 'prepared' : 'needed'}</span>
    </label>`;
  }).join('');

  document.querySelectorAll('[data-evidence]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) preparedEvidence.add(input.dataset.evidence); else preparedEvidence.delete(input.dataset.evidence);
    renderPassport(latestResult);
  }));

  document.querySelector('#service-readiness').innerHTML = passport.serviceReadiness.map((service) => {
    const required = service.required;
    const ready = required.filter((id) => passport.evidence.find((e) => e.id === id)?.status === 'claim_available' || preparedEvidence.has(id));
    const percent = Math.round((ready.length / required.length) * 100);
    return `<div class="readiness-card">
      <div class="readiness-head"><strong>${serviceName(service.service)}</strong><span>${ready.length}/${required.length} ready</span></div>
      <div class="progress"><i style="width:${percent}%"></i></div>
      <div class="reuse-chips">${required.map((id) => `<span class="${ready.includes(id) ? 'ready' : ''}">${shortEvidence(id)}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

function serviceName(id) {
  return ({ kiz: 'Kinderzuschlag', wohngeld: 'Wohngeld', but: 'Bildung & Teilhabe' })[id] || id;
}

function shortEvidence(id) {
  return ({ child_household: 'household', income_proof: 'income', housing_proof: 'housing', rent_payment_proof: 'rent payments', benefit_notice: 'award notice' })[id] || id;
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
  if (input.traceId && traceStore.has(input.traceId)) return traceStore.get(input.traceId);
  if (input.household) return evaluate(input.household);
  if (latestResult) return latestResult;
  return evaluate();
}

function passportWithLocalState(result) {
  if (!result) return null;
  return {
    ...result.passport,
    evidence: result.passport.evidence.map((item) => ({
      ...item,
      localPreparationStatus: evidenceState(item)
    })),
    localPreparedEvidence: [...preparedEvidence]
  };
}

function applicationPlan(result, service) {
  const readiness = result.passport.serviceReadiness.find((item) => item.service === service);
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
    name: 'check_eligibility',
    title: 'Check family-benefit pathways',
    description: 'Check a German household against Benefit Bridge preliminary family-benefit gates. Orientation only: returns sources and uncertainty, never a legal entitlement.',
    inputSchema: { type: 'object', properties: { household: { type: 'object', description: 'Household with adults, children ages, monthlyGrossIncome, warmRent and receivesKindergeld.' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ household }) => compactResult(await evaluate(household))
  },
  {
    name: 'calculate_support',
    title: 'Calculate anchored support amounts',
    description: 'Return only amounts Benefit Bridge can justify from pinned 2026 anchors, separating known amounts, maximum potentials, yearly anchors and official-check-only values.',
    inputSchema: { type: 'object', properties: { household: { type: 'object' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ household }) => {
      const r = await evaluate(household);
      return { traceId: r.traceId, summary: r.summary, amounts: r.benefits.map(({ id, monthlyAmount, annualAnchor, amountKind, confidence }) => ({ id, monthlyAmount, annualAnchor, amountKind, confidence })), boundary: r.boundary };
    }
  },
  {
    name: 'list_missing_evidence',
    title: 'List evidence to prepare',
    description: 'List evidence categories flagged for the latest or supplied household evaluation, preserving the difference between claims and documentary evidence.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' }, household: { type: 'object' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async (input) => {
      const r = await ensureResult(input);
      return { traceId: r.traceId, missingEvidence: r.missingEvidence.filter((item) => !preparedEvidence.has(item.id)), locallyPrepared: [...preparedEvidence], boundary: r.boundary };
    }
  },
  {
    name: 'explain_result',
    title: 'Explain a Benefit Bridge result',
    description: 'Explain why a Benefit Bridge result was produced using the stored deterministic trace and source anchors.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ traceId }) => {
      const r = traceStore.get(traceId);
      if (!r) return { error: 'Trace not found in this browser session.' };
      return { traceId, headline: r.summary.headline, explanation: r.trace, sources: r.benefits.map((b) => ({ benefit: b.title, url: b.source.url, fact: b.source.fact })), boundary: r.boundary };
    }
  },
  {
    name: 'prepare_next_steps',
    title: 'Prepare safe next steps',
    description: 'Return ordered human-reviewable next actions and official service links. Cannot submit an application or act on the user’s behalf.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ traceId }) => {
      const r = traceStore.get(traceId);
      if (!r) return { error: 'Trace not found in this browser session.' };
      return { traceId, nextSteps: r.nextSteps, requiresHumanAction: true, boundary: r.boundary };
    }
  },
  {
    name: 'replay_case',
    title: 'Replay the evaluation trace',
    description: 'Replay the exact Benefit Bridge rule trace and derived Benefit Passport for a trace ID.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, required: ['traceId'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ traceId }) => {
      const r = traceStore.get(traceId);
      if (!r) return { error: 'Trace not found in this browser session.' };
      return { traceId, policyVersion: r.policyVersion, household: r.household, trace: r.trace, passport: passportWithLocalState(r), result: compactResult(r) };
    }
  },
  {
    name: 'derive_benefit_passport',
    title: 'Derive a reusable Benefit Passport',
    description: 'Derive structured self-attested claims, evidence categories and cross-service reuse from a household snapshot. Does not persist or verify documents.',
    inputSchema: { type: 'object', properties: { household: { type: 'object' } }, required: ['household'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async ({ household }) => passportWithLocalState(await evaluate(household))
  },
  {
    name: 'get_passport_status',
    title: 'Inspect current Benefit Passport readiness',
    description: 'Read the latest Benefit Passport plus human-marked local evidence readiness. Read only; does not mark evidence as verified.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' } }, additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async (input) => passportWithLocalState(await ensureResult(input))
  },
  {
    name: 'plan_application',
    title: 'Plan one application from the passport',
    description: 'Build an evidence preparation plan for KiZ, Wohngeld or Bildung & Teilhabe from the current Benefit Passport. Never submits or signs anything.',
    inputSchema: { type: 'object', properties: { traceId: { type: 'string' }, service: { type: 'string', enum: ['kiz', 'wohngeld', 'but'] } }, required: ['service'], additionalProperties: false },
    annotations: { readOnlyHint: true },
    execute: async (input) => applicationPlan(await ensureResult(input), input.service)
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
  statusEl.classList.add('ready');
  statusEl.innerHTML = `<span class="status-dot"></span>${shimmed ? 'WebMCP test shim · 9 tools' : 'WebMCP native · 9 tools'}`;
  renderToolButtons();
  return controller;
}

function demoArgs(tool) {
  if (['check_eligibility', 'calculate_support', 'derive_benefit_passport'].includes(tool.name)) return { household: householdFromForm() };
  if (tool.name === 'plan_application') return { traceId: latestResult?.traceId, service: 'kiz' };
  return { traceId: latestResult?.traceId };
}

function renderToolButtons() {
  toolButtons.innerHTML = [...localTools.values()].map((tool) => `<button class="tool-button ${tool.name.includes('passport') || tool.name === 'plan_application' ? 'new-tool' : ''}" data-tool="${tool.name}"><code>${tool.name}</code><span>run →</span></button>`).join('');
  toolButtons.querySelectorAll('button').forEach((button) => button.addEventListener('click', async () => {
    const tool = localTools.get(button.dataset.tool);
    if (!latestResult && !['check_eligibility', 'calculate_support', 'derive_benefit_passport'].includes(tool.name)) {
      outputEl.textContent = 'Build a household bridge first so this tool has a trace/passport to inspect.';
      return;
    }
    outputEl.textContent = 'Running…';
    try { outputEl.textContent = JSON.stringify(await tool.execute(demoArgs(tool)), null, 2); }
    catch (error) { outputEl.textContent = `Error: ${error.message}`; }
  }));
}

function savePassport() {
  if (!latestResult) return;
  const payload = {
    savedAt: new Date().toISOString(),
    household: latestResult.household,
    passportId: latestResult.passport.passportId,
    preparedEvidence: [...preparedEvidence]
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  updateSavedStatus(payload);
  savePassportButton.textContent = 'Saved locally ✓';
}

function forgetPassport() {
  localStorage.removeItem(STORAGE_KEY);
  preparedEvidence = new Set();
  savedStatus.textContent = 'No saved passport';
  forgetPassportButton.classList.add('hidden');
  savePassportButton.textContent = 'Save to this browser';
  if (latestResult) renderPassport(latestResult);
}

function updateSavedStatus(saved) {
  savedStatus.textContent = `Saved ${saved.passportId}`;
  forgetPassportButton.classList.remove('hidden');
}

async function restoreSavedPassport() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved?.household) return;
    preparedEvidence = new Set(saved.preparedEvidence || []);
    updateSavedStatus(saved);
    document.querySelector('input[name="householdType"][value="single"]').checked = saved.household.singleParent;
    document.querySelector('input[name="householdType"][value="couple"]').checked = !saved.household.singleParent;
    document.querySelector('#income').value = saved.household.monthlyGrossIncome;
    document.querySelector('#rent').value = saved.household.warmRent;
    document.querySelector('#kindergeld').checked = saved.household.receivesKindergeld;
    childrenList.innerHTML = ''; childCounter = 0; saved.household.children.forEach((child) => addChild(child.age));
    await evaluate(saved.household);
    savePassportButton.textContent = 'Saved locally ✓';
  } catch (error) {
    console.warn('Could not restore local passport', error);
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = document.querySelector('#evaluate-button');
  button.disabled = true;
  button.firstElementChild.textContent = 'Building…';
  try { await evaluate(); }
  catch (error) { alert(error.message); }
  finally { button.disabled = false; button.firstElementChild.textContent = 'Build my bridge'; }
});

document.querySelector('#add-child').addEventListener('click', () => addChild(6));
document.querySelector('#load-demo').addEventListener('click', () => {
  document.querySelector('input[name="householdType"][value="single"]').checked = true;
  document.querySelector('#income').value = 2000;
  document.querySelector('#rent').value = 1100;
  document.querySelector('#kindergeld').checked = true;
  childrenList.innerHTML = ''; childCounter = 0; addChild(7); addChild(12);
});
savePassportButton.addEventListener('click', savePassport);
forgetPassportButton.addEventListener('click', forgetPassport);

addChild(7); addChild(12);
registerWebMCP().then(restoreSavedPassport).catch((error) => {
  statusEl.textContent = `WebMCP registration failed: ${error.message}`;
  console.error(error);
});
