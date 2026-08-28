import { prepareLocalApplicationPacket, validateLocalApplicationPacket } from './packet-core.js';

let latestResult = null;
let currentService = 'kiz';
let preparedEvidence = new Set();
let latestPacket = null;
let reviewState = { claims_reviewed: false, evidence_status_reviewed: false, not_submission_understood: false };

const serviceLabel = (id) => ({ kiz: 'Kinderzuschlag', wohngeld: 'Wohngeld', but: 'Bildung & Teilhabe' })[id] || id;
const evidenceLabel = (id) => ({ child_household: 'Household facts', identity_documents: 'Identity documents', income_proof: 'Income evidence', housing_proof: 'Housing evidence', rent_payment_proof: 'Recent rent-payment proof', benefit_notice: 'Award notice' })[id] || id;

function householdFromPage() {
  const form = document.querySelector('#household-form');
  const singleParent = form?.elements.householdType?.value === 'single';
  return {
    adults: singleParent ? 1 : 2,
    singleParent,
    children: [...document.querySelectorAll('#children-list input')].map((input) => ({ age: Number(input.value) })),
    monthlyGrossIncome: Number(document.querySelector('#income')?.value || 0),
    warmRent: Number(document.querySelector('#rent')?.value || 0),
    receivesKindergeld: document.querySelector('#kindergeld')?.checked !== false,
    city: 'Berlin'
  };
}

async function fetchResult() {
  const response = await fetch('/api/evaluate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ household: householdFromPage() })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.errors?.join(' ') || result.error || 'Evaluation failed');
  latestResult = result;
  syncPreparedFromPassportLocker();
  renderStudio();
  return result;
}

function syncPreparedFromPassportLocker() {
  document.querySelectorAll('[data-evidence]').forEach((input) => {
    if (input.checked && !input.disabled) preparedEvidence.add(input.dataset.evidence);
    if (!input.checked && !input.disabled) preparedEvidence.delete(input.dataset.evidence);
  });
}

function applicationDetails() {
  return {
    applicant_name: document.querySelector('#v03-applicant-name')?.value || '',
    applicant_address: document.querySelector('#v03-applicant-address')?.value || '',
    applicant_email: document.querySelector('#v03-applicant-email')?.value || '',
    basic_security_status: document.querySelector('#v03-basic-security')?.value || '',
    residency_basis: document.querySelector('#v03-residency')?.value || ''
  };
}

function studioMarkup() {
  return `<section id="application-studio" class="application-studio panel hidden">
    <div class="application-header">
      <div><span class="section-index">04</span><p class="eyebrow-small">APPLICATION STUDIO</p><h2>Prepare the packet. Keep the final click human.</h2><p class="application-intro">Not the authority's official form: a provenance-aware preparation layer that pre-fills what Benefit Passport knows, binds evidence, exposes gaps and exports only after human review.</p></div>
      <div class="service-switch"><button data-v03-service="kiz" class="active">KiZ</button><button data-v03-service="wohngeld">Wohngeld</button><button data-v03-service="but">BuT</button></div>
    </div>
    <div class="application-layout">
      <div class="application-details-card"><div class="subhead"><h3>Local-only applicant details</h3><span>not sent to /api/evaluate</span></div><div class="app-field-grid">
        <label><span>Applicant name</span><input id="v03-applicant-name" value="Mara Beispiel"></label>
        <label><span>Contact email</span><input id="v03-applicant-email" value="mara@example.invalid"></label>
        <label class="wide"><span>Address</span><input id="v03-applicant-address" value="Sonnenallee 100, 12045 Berlin"></label>
        <label id="v03-basic-wrap"><span>Basic-security receipt</span><select id="v03-basic-security"><option>No (self-attested)</option><option>Yes (self-attested)</option><option>Unknown</option></select></label>
        <label id="v03-residency-wrap" class="hidden"><span>Residence / residence-right basis</span><select id="v03-residency"><option>German / EU status to be confirmed by applicant</option><option>Non-EU residence document to be attached</option><option>Unknown</option></select></label>
      </div><p class="local-note">Synthetic demo values by default. These identity/contact fields stay in this page unless you export.</p></div>
      <div class="packet-card"><div class="packet-head"><div><small id="v03-service-label">Kinderzuschlag</small><strong id="v03-packet-id">Build a bridge first</strong></div><span id="v03-packet-status" class="packet-status">waiting</span></div>
        <div class="packet-meter"><div><span>Fields</span><strong id="v03-fields-metric">—</strong></div><div><span>Evidence</span><strong id="v03-evidence-metric">—</strong></div><div><span>Blockers</span><strong id="v03-blockers-metric">—</strong></div></div>
        <div class="packet-columns"><div><h3>Pre-filled fields</h3><div id="v03-fields" class="packet-list"></div></div><div><h3>Evidence bindings</h3><div id="v03-evidence" class="packet-list"></div></div></div>
        <div class="packet-columns packet-lower"><div><h3>Derived signals</h3><div id="v03-signals" class="packet-list"></div></div><div><h3>Still needs a human</h3><div id="v03-blockers" class="packet-list"></div></div></div>
        <div class="official-components"><span>Official handoff expects</span><div id="v03-components"></div></div>
      </div>
    </div>
    <div class="approval-gate"><div class="approval-copy"><span class="lock-icon">⌾</span><div><p class="eyebrow-small">HUMAN APPROVAL GATE</p><h3>Review before export</h3><p>Approval creates a local review manifest. It never submits or signs.</p></div></div>
      <div class="approval-checks"><label><input type="checkbox" data-v03-review="claims_reviewed"><span>I reviewed the pre-filled claims and local applicant details.</span></label><label><input type="checkbox" data-v03-review="evidence_status_reviewed"><span>I reviewed prepared versus missing evidence.</span></label><label><input type="checkbox" data-v03-review="not_submission_understood"><span>I understand this export is <strong>not</strong> a submission.</span></label></div>
      <div class="approval-actions"><a id="v03-official-link" class="secondary-button official-button" href="#" target="_blank" rel="noreferrer">Open official service ↗</a><button id="v03-approve" class="primary-button compact" disabled>Approve draft for export</button><button id="v03-export" class="passport-button hidden">Export reviewed packet ↓</button></div><p id="v03-approval-status" class="approval-status">Complete the three review confirmations to approve a local draft.</p>
    </div>
  </section>`;
}

function injectStudio() {
  if (document.querySelector('#application-studio')) return;
  const passport = document.querySelector('#passport-panel');
  if (!passport) return;
  passport.insertAdjacentHTML('afterend', studioMarkup());
  document.querySelectorAll('[data-v03-service]').forEach((button) => button.addEventListener('click', () => { currentService = button.dataset.v03Service; resetReview(); renderStudio(); }));
  document.querySelectorAll('#application-studio input, #application-studio select').forEach((input) => {
    if (input.dataset.v03Review) return;
    input.addEventListener('change', () => { resetReview(); renderStudio(); });
    input.addEventListener('input', () => { resetReview(); renderStudio(); });
  });
  document.querySelectorAll('[data-v03-review]').forEach((input) => input.addEventListener('change', () => { reviewState[input.dataset.v03Review] = input.checked; updateApproval(); }));
  document.querySelector('#v03-approve').addEventListener('click', approveExport);
  document.querySelector('#v03-export').addEventListener('click', exportPacket);
}

function item(label, value, status = '', badge = '') {
  return `<div class="packet-item ${status}"><div><small>${label}</small><strong>${value ?? 'Not provided'}</strong></div><em>${badge}</em></div>`;
}

function renderStudio() {
  injectStudio();
  const studio = document.querySelector('#application-studio');
  if (!studio || !latestResult) return;
  studio.classList.remove('hidden');
  document.querySelectorAll('[data-v03-service]').forEach((b) => b.classList.toggle('active', b.dataset.v03Service === currentService));
  document.querySelector('#v03-basic-wrap').classList.toggle('hidden', currentService !== 'kiz');
  document.querySelector('#v03-residency-wrap').classList.toggle('hidden', currentService !== 'wohngeld');
  latestPacket = prepareLocalApplicationPacket(latestResult, currentService, { applicationDetails: applicationDetails(), preparedEvidence: [...preparedEvidence] });
  const packet = latestPacket;
  document.querySelector('#v03-service-label').textContent = packet.serviceLabel;
  document.querySelector('#v03-packet-id').textContent = packet.packetId;
  const status = document.querySelector('#v03-packet-status'); status.textContent = packet.status.replaceAll('_', ' '); status.className = `packet-status ${packet.status}`;
  document.querySelector('#v03-official-link').href = packet.officialDestination.url;
  const filled = packet.fields.filter((f) => f.value != null).length;
  const evidenceReady = packet.evidenceBindings.filter((e) => e.status !== 'missing').length;
  document.querySelector('#v03-fields-metric').textContent = `${filled}/${packet.fields.length}`;
  document.querySelector('#v03-evidence-metric').textContent = `${evidenceReady}/${packet.evidenceBindings.length}`;
  document.querySelector('#v03-blockers-metric').textContent = packet.unresolvedFields.length + packet.missingEvidence.length;
  document.querySelector('#v03-fields').innerHTML = packet.fields.map((f) => item(f.label, f.value, f.value ? 'ready' : 'missing', f.provenance.type === 'self_attested_claim' ? 'passport claim' : f.value ? 'local input' : 'human needed')).join('');
  document.querySelector('#v03-evidence').innerHTML = packet.evidenceBindings.map((e) => `<label class="packet-item ${e.status === 'missing' ? 'missing' : 'ready'}"><div><small>${e.label}</small><strong>${e.status === 'claim_available' ? 'Structured claim available' : e.status === 'prepared_by_human' ? 'Marked prepared by human' : 'Not yet prepared'}</strong></div><span class="packet-evidence-toggle"><input type="checkbox" data-v03-evidence="${e.id}" ${e.status !== 'missing' ? 'checked' : ''} ${e.status === 'claim_available' ? 'disabled' : ''}> ${e.status === 'missing' ? 'mark prepared' : e.status === 'claim_available' ? 'claim' : 'prepared'}</span></label>`).join('');
  document.querySelectorAll('[data-v03-evidence]').forEach((input) => input.addEventListener('change', () => { if (input.checked) preparedEvidence.add(input.dataset.v03Evidence); else preparedEvidence.delete(input.dataset.v03Evidence); resetReview(); renderStudio(); }));
  document.querySelector('#v03-signals').innerHTML = packet.derivedSignals.map((s) => item(s.label, `${s.value}${s.amount != null ? ` · €${s.amount}${currentService === 'but' ? '/year anchor' : ''}` : ''}`, 'ready', 'derived')).join('') || item('No derived signal', 'Preparation only', '', 'boundary');
  const blockers = [...packet.unresolvedFields.map((id) => [id.replaceAll('_', ' '), 'Required local human input']), ...packet.missingEvidence.map((id) => [evidenceLabel(id), 'Evidence not yet marked prepared'])];
  document.querySelector('#v03-blockers').innerHTML = blockers.map(([l,v]) => item(l,v,'missing','blocker')).join('') || item('No preparation blockers', 'Ready for human review', 'ready', 'clear');
  document.querySelector('#v03-components').innerHTML = packet.officialComponents.map((c) => `<i>${c}</i>`).join('');
  updateApproval();
}

function resetReview() {
  reviewState = { claims_reviewed: false, evidence_status_reviewed: false, not_submission_understood: false };
  document.querySelectorAll('[data-v03-review]').forEach((i) => { i.checked = false; });
  document.querySelector('#v03-export')?.classList.add('hidden');
}

function updateApproval() {
  if (!latestPacket) return;
  const validation = validateLocalApplicationPacket(latestPacket, reviewState);
  const approve = document.querySelector('#v03-approve');
  const status = document.querySelector('#v03-approval-status');
  approve.disabled = !validation.canApproveDraftForExport;
  status.classList.remove('approved');
  if (validation.missingConfirmations.length) status.textContent = `${validation.missingConfirmations.length} review confirmation${validation.missingConfirmations.length === 1 ? '' : 's'} remaining.`;
  else if (validation.blockers.length) status.textContent = `Review complete. ${validation.blockers.length} blocker${validation.blockers.length === 1 ? '' : 's'} remain; export will stay DRAFT.`;
  else status.textContent = 'Review complete. Ready for official-service handoff after local export.';
}

function approveExport() {
  const validation = validateLocalApplicationPacket(latestPacket, reviewState);
  if (!validation.canApproveDraftForExport) return;
  latestPacket = { ...latestPacket, humanReview: { approvedAt: new Date().toISOString(), confirmations: { ...reviewState }, readyForOfficialServiceHandoff: validation.readyForOfficialServiceHandoff, submissionAllowed: false, statement: validation.boundary } };
  document.querySelector('#v03-export').classList.remove('hidden');
  const status = document.querySelector('#v03-approval-status'); status.classList.add('approved'); status.textContent = `${validation.readyForOfficialServiceHandoff ? 'Reviewed ✓ Ready for official-service handoff.' : 'Reviewed ✓ Draft export approved with blockers.'} Nothing has been submitted.`;
}

function exportPacket() {
  if (!latestPacket?.humanReview) return;
  const bundle = { exportedAt: new Date().toISOString(), product: 'Benefit Bridge v0.3', packet: latestPacket, explicitBoundary: 'LOCAL EXPORT ONLY — NOT SUBMITTED TO ANY AUTHORITY' };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `benefit-bridge-${latestPacket.service}-${latestPacket.packetId}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

async function registerV03Tools() {
  if (!document.modelContext?.registerTool) return;
  const tools = [
    {
      name: 'prepare_application_packet', title: 'Prepare a provenance-aware application packet',
      description: 'Prepare a browser-local draft packet using Benefit Passport claims, local applicant details and human-marked evidence. Never submits or signs.',
      inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['kiz','wohngeld','but'] }, applicationDetails: { type: 'object' }, preparedEvidence: { type: 'array', items: { type: 'string' } } }, required: ['service'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async (input) => prepareLocalApplicationPacket(latestResult || await fetchResult(), input.service, { applicationDetails: input.applicationDetails || applicationDetails(), preparedEvidence: input.preparedEvidence || [...preparedEvidence] })
    },
    {
      name: 'validate_application_packet', title: 'Validate packet blockers and approval requirements',
      description: 'Report missing fields, evidence blockers and human-review requirements for a browser-local application packet. Never changes or submits it.',
      inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['kiz','wohngeld','but'] } }, required: ['service'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async (input) => validateLocalApplicationPacket(prepareLocalApplicationPacket(latestResult || await fetchResult(), input.service, { applicationDetails: applicationDetails(), preparedEvidence: [...preparedEvidence] }), reviewState)
    }
  ];
  for (const tool of tools) await document.modelContext.registerTool(tool);
  const pill = document.querySelector('#webmcp-status');
  if (pill) pill.innerHTML = '<span class="status-dot"></span>WebMCP · 11 read-only tools';
}

function observeBaseApp() {
  injectStudio();
  document.querySelector('#household-form')?.addEventListener('submit', () => setTimeout(() => fetchResult().catch(console.error), 120));
  document.querySelector('#load-demo')?.addEventListener('click', () => setTimeout(() => fetchResult().catch(console.error), 80));
  document.addEventListener('change', (event) => {
    if (event.target.matches?.('[data-evidence]')) { syncPreparedFromPassportLocker(); if (latestResult) renderStudio(); }
  });
  const observer = new MutationObserver(() => {
    if (!latestResult && !document.querySelector('#passport-panel')?.classList.contains('hidden')) fetchResult().catch(console.error);
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}

observeBaseApp();
setTimeout(() => registerV03Tools().catch(console.error), 300);
