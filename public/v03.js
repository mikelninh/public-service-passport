import { prepareLocalApplicationPacket, validateLocalApplicationPacket } from './packet-core.js';
import { escapeHtml, safeText } from './safe-html.js';

let latestResult = null;
let currentService = 'kiz';
let preparedEvidence = new Set();
let latestPacket = null;
let reviewState = { claims_reviewed: false, evidence_status_reviewed: false, not_submission_understood: false };

const serviceLabel = (id) => ({ kiz: 'Kinderzuschlag', wohngeld: 'Wohngeld', but: 'Bildung & Teilhabe' })[id] || id;
const evidenceLabel = (id) => ({ child_household: 'Haushaltsangaben', identity_documents: 'Identitätsnachweis', income_proof: 'Einkommensnachweise', housing_proof: 'Miet-/Wohnkostennachweis', rent_payment_proof: 'Mietzahlungsnachweis', benefit_notice: 'Bewilligungsbescheid' })[id] || id;
const fieldLabel = (id, fallback) => ({ applicant_name: 'Name', applicant_address: 'Adresse', applicant_email: 'E-Mail', household_type: 'Haushalt', children: 'Kinder', income: 'Bruttoeinkommen', rent: 'Warmmiete', kindergeld_status: 'Kindergeld', basic_security_status: 'Bezug von Grundsicherung', residency_basis: 'Aufenthaltsstatus / Aufenthaltsrecht' })[id] || fallback;

function householdFromPage() {
  const form = document.querySelector('#household-form');
  const singleParent = form?.elements.householdType?.value === 'single';
  return {
    adults: singleParent ? 1 : 2,
    singleParent,
    children: [...document.querySelectorAll('#children-list input')].map((input) => ({ age: Number(input.value) })),
    monthlyGrossIncome: Number(document.querySelector('#income')?.value || 0),
    warmRent: Number(document.querySelector('#rent')?.value || 0),
    receivesKindergeld: document.querySelector('#kindergeld')?.checked === true,
    city: 'Berlin'
  };
}

async function fetchResult() {
  const response = await fetch('/api/evaluate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ household: householdFromPage() })
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.errors?.join(' ') || result.error || 'Prüfung fehlgeschlagen.');
  setLatestResult(result);
  return result;
}

function setLatestResult(result) {
  latestResult = result;
  syncPreparedFromPassportLocker();
  renderStudio();
}

function syncPreparedFromPassportLocker() {
  document.querySelectorAll('[data-evidence]').forEach((input) => {
    if (input.checked && !input.disabled) preparedEvidence.add(input.dataset.evidence);
    if (!input.checked && !input.disabled) preparedEvidence.delete(input.dataset.evidence);
  });
}

function applicationDetails() {
  return {
    applicant_name: safeText(document.querySelector('#v03-applicant-name')?.value, 120),
    applicant_address: safeText(document.querySelector('#v03-applicant-address')?.value, 300),
    applicant_email: safeText(document.querySelector('#v03-applicant-email')?.value, 254),
    basic_security_status: safeText(document.querySelector('#v03-basic-security')?.value, 80),
    residency_basis: safeText(document.querySelector('#v03-residency')?.value, 160)
  };
}

function studioMarkup() {
  return `<section id="application-studio" class="application-studio citizen-application panel hidden">
    <div class="application-header">
      <div><span class="section-index">04</span><p class="eyebrow-small">ANTRAG VORBEREITEN</p><h2>Entwurf vorbereiten. Sie prüfen. Sie entscheiden.</h2><p class="application-intro">Wir übernehmen bekannte Angaben in einen lokalen Entwurf und zeigen, was noch fehlt. Das ist nicht das offizielle Formular und es wird nichts automatisch versendet.</p></div>
      <div class="service-switch" aria-label="Leistung auswählen"><button data-v03-service="kiz" class="active">KiZ</button><button data-v03-service="wohngeld">Wohngeld</button><button data-v03-service="but">Bildung & Teilhabe</button></div>
    </div>

    <div class="application-layout">
      <div class="application-details-card">
        <div class="subhead"><h3>Persönliche Angaben ergänzen</h3><span>bleiben für die Vorbereitung im Browser</span></div>
        <div class="app-field-grid">
          <label><span>Name</span><input id="v03-applicant-name" maxlength="120" autocomplete="name" value="Mara Beispiel"></label>
          <label><span>E-Mail</span><input id="v03-applicant-email" type="email" maxlength="254" autocomplete="email" value="mara@example.invalid"></label>
          <label class="wide"><span>Adresse</span><input id="v03-applicant-address" maxlength="300" autocomplete="street-address" value="Sonnenallee 100, 12045 Berlin"></label>
          <label id="v03-basic-wrap"><span>Grundsicherung</span><select id="v03-basic-security"><option>Nein (selbst angegeben)</option><option>Ja (selbst angegeben)</option><option>Unbekannt</option></select></label>
          <label id="v03-residency-wrap" class="hidden"><span>Aufenthaltsstatus / Aufenthaltsrecht</span><select id="v03-residency"><option>Deutsch / EU — durch Person zu bestätigen</option><option>Nicht-EU — Dokument beifügen</option><option>Unbekannt</option></select></label>
        </div>
        <p class="local-note">Die Beispielwerte sind synthetisch. Identitäts- und Kontaktdaten werden für den Leistungs-Check nicht an <code>/api/evaluate</code> gesendet.</p>
      </div>

      <div class="packet-card">
        <div class="packet-head"><div><small id="v03-service-label">Kinderzuschlag</small><strong id="v03-packet-id">Zuerst Leistungs-Check durchführen</strong></div><span id="v03-packet-status" class="packet-status">wartet</span></div>
        <div class="packet-meter"><div><span>Angaben</span><strong id="v03-fields-metric">—</strong></div><div><span>Unterlagen</span><strong id="v03-evidence-metric">—</strong></div><div><span>Noch offen</span><strong id="v03-blockers-metric">—</strong></div></div>

        <div class="packet-columns citizen-primary-packet">
          <div><h3>Was fehlt noch?</h3><div id="v03-blockers" class="packet-list"></div></div>
          <div><h3>Unterlagen</h3><div id="v03-evidence" class="packet-list"></div></div>
        </div>

        <details class="packet-details"><summary>Alle vorausgefüllten Angaben ansehen</summary><div id="v03-fields" class="packet-list"></div></details>
        <details class="packet-details"><summary>Technische Herleitung ansehen</summary><div id="v03-signals" class="packet-list"></div></details>
        <details class="packet-details"><summary>Was der offizielle Dienst zusätzlich erwartet</summary><div class="official-components"><div id="v03-components"></div></div></details>
      </div>
    </div>

    <div class="approval-gate citizen-approval">
      <div class="approval-copy"><span class="lock-icon">✓</span><div><p class="eyebrow-small">IHRE FREIGABE</p><h3>Vor einem Export noch einmal prüfen</h3><p>Die Freigabe bestätigt nur Ihren lokalen Entwurf. Sie ist keine Antragstellung.</p></div></div>
      <div class="approval-checks">
        <label><input type="checkbox" data-v03-review="claims_reviewed"><span>Ich habe meine Angaben geprüft.</span></label>
        <label><input type="checkbox" data-v03-review="evidence_status_reviewed"><span>Ich habe geprüft, welche Unterlagen vorhanden oder noch offen sind.</span></label>
        <label><input type="checkbox" data-v03-review="not_submission_understood"><span>Ich verstehe: Dieser Export <strong>sendet nichts an eine Behörde.</strong></span></label>
      </div>
      <div class="approval-actions"><a id="v03-official-link" class="secondary-button official-button" href="#" target="_blank" rel="noreferrer">Offiziellen Dienst öffnen ↗</a><button id="v03-approve" class="primary-button compact" disabled>Entwurf freigeben</button><button id="v03-export" class="passport-button hidden">Geprüften Entwurf exportieren ↓</button></div>
      <p id="v03-approval-status" class="approval-status">Bitte die drei Prüfpunkte bestätigen.</p>
    </div>
  </section>`;
}

function injectStudio() {
  if (document.querySelector('#application-studio')) return;
  const passport = document.querySelector('#passport-panel');
  if (!passport) return;
  passport.insertAdjacentHTML('afterend', studioMarkup());

  document.querySelectorAll('[data-v03-service]').forEach((button) => button.addEventListener('click', () => {
    currentService = button.dataset.v03Service;
    resetReview();
    renderStudio();
  }));
  document.querySelectorAll('#application-studio input, #application-studio select').forEach((input) => {
    if (input.dataset.v03Review) return;
    input.addEventListener('change', () => { resetReview(); renderStudio(); });
    input.addEventListener('input', () => { resetReview(); renderStudio(); });
  });
  document.querySelectorAll('[data-v03-review]').forEach((input) => input.addEventListener('change', () => {
    reviewState[input.dataset.v03Review] = input.checked;
    updateApproval();
  }));
  document.querySelector('#v03-approve').addEventListener('click', approveExport);
  document.querySelector('#v03-export').addEventListener('click', exportPacket);
}

function item(label, value, status = '', badge = '') {
  return `<div class="packet-item ${escapeHtml(status)}"><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value ?? 'Nicht angegeben')}</strong></div><em>${escapeHtml(badge)}</em></div>`;
}

function renderStudio() {
  injectStudio();
  const studio = document.querySelector('#application-studio');
  if (!studio || !latestResult) return;
  studio.classList.remove('hidden');
  document.querySelectorAll('[data-v03-service]').forEach((button) => button.classList.toggle('active', button.dataset.v03Service === currentService));
  document.querySelector('#v03-basic-wrap').classList.toggle('hidden', currentService !== 'kiz');
  document.querySelector('#v03-residency-wrap').classList.toggle('hidden', currentService !== 'wohngeld');

  latestPacket = prepareLocalApplicationPacket(latestResult, currentService, { applicationDetails: applicationDetails(), preparedEvidence: [...preparedEvidence] });
  const packet = latestPacket;
  document.querySelector('#v03-service-label').textContent = packet.serviceLabel;
  document.querySelector('#v03-packet-id').textContent = packet.packetId;
  const status = document.querySelector('#v03-packet-status');
  status.textContent = packet.status === 'ready_for_human_review' ? 'bereit zur Prüfung' : 'noch unvollständig';
  status.className = `packet-status ${packet.status}`;
  document.querySelector('#v03-official-link').href = packet.officialDestination.url;

  const filled = packet.fields.filter((field) => field.value != null).length;
  const evidenceReady = packet.evidenceBindings.filter((entry) => entry.status !== 'missing').length;
  document.querySelector('#v03-fields-metric').textContent = `${filled}/${packet.fields.length}`;
  document.querySelector('#v03-evidence-metric').textContent = `${evidenceReady}/${packet.evidenceBindings.length}`;
  document.querySelector('#v03-blockers-metric').textContent = packet.unresolvedFields.length + packet.missingEvidence.length;

  document.querySelector('#v03-fields').innerHTML = packet.fields.map((field) => item(fieldLabel(field.id, field.label), field.value, field.value ? 'ready' : 'missing', field.provenance.type === 'self_attested_claim' ? 'Ihre Angabe' : field.value ? 'lokal ergänzt' : 'noch nötig')).join('');
  document.querySelector('#v03-evidence').innerHTML = packet.evidenceBindings.map((entry) => `<label class="packet-item ${entry.status === 'missing' ? 'missing' : 'ready'}"><div><small>${escapeHtml(evidenceLabel(entry.id))}</small><strong>${entry.status === 'claim_available' ? 'Angabe vorhanden' : entry.status === 'prepared_by_human' ? 'Von Ihnen als vorbereitet markiert' : 'Noch nicht vorbereitet'}</strong></div><span class="packet-evidence-toggle"><input type="checkbox" data-v03-evidence="${escapeHtml(entry.id)}" ${entry.status !== 'missing' ? 'checked' : ''} ${entry.status === 'claim_available' ? 'disabled' : ''}> ${entry.status === 'missing' ? 'als vorbereitet markieren' : entry.status === 'claim_available' ? 'Angabe' : 'vorbereitet'}</span></label>`).join('');
  document.querySelectorAll('[data-v03-evidence]').forEach((input) => input.addEventListener('change', () => {
    if (input.checked) preparedEvidence.add(input.dataset.v03Evidence); else preparedEvidence.delete(input.dataset.v03Evidence);
    resetReview();
    renderStudio();
  }));

  document.querySelector('#v03-signals').innerHTML = packet.derivedSignals.map((signal) => item(signal.label, `${signal.value}${signal.amount != null ? ` · €${signal.amount}${currentService === 'but' ? '/Jahr' : ''}` : ''}`, 'ready', 'abgeleiteter Hinweis')).join('') || item('Keine abgeleiteten Hinweise', 'Nur Vorbereitung', '', 'Grenze');
  const blockers = [
    ...packet.unresolvedFields.map((id) => [fieldLabel(id, id.replaceAll('_', ' ')), 'Diese Angabe fehlt noch.']),
    ...packet.missingEvidence.map((id) => [evidenceLabel(id), 'Diese Unterlage ist noch nicht als vorbereitet markiert.'])
  ];
  document.querySelector('#v03-blockers').innerHTML = blockers.map(([label, value]) => item(label, value, 'missing', 'offen')).join('') || item('Nichts mehr offen', 'Der Entwurf ist bereit für Ihre Prüfung.', 'ready', 'bereit');
  document.querySelector('#v03-components').innerHTML = packet.officialComponents.map((component) => `<i>${escapeHtml(component)}</i>`).join('');
  updateApproval();
}

function resetReview() {
  reviewState = { claims_reviewed: false, evidence_status_reviewed: false, not_submission_understood: false };
  document.querySelectorAll('[data-v03-review]').forEach((input) => { input.checked = false; });
  document.querySelector('#v03-export')?.classList.add('hidden');
}

function updateApproval() {
  if (!latestPacket) return;
  const validation = validateLocalApplicationPacket(latestPacket, reviewState);
  const approve = document.querySelector('#v03-approve');
  const status = document.querySelector('#v03-approval-status');
  approve.disabled = !validation.canApproveDraftForExport;
  status.classList.remove('approved');
  if (validation.missingConfirmations.length) status.textContent = `Noch ${validation.missingConfirmations.length} Prüfpunkt${validation.missingConfirmations.length === 1 ? '' : 'e'} bestätigen.`;
  else if (validation.blockers.length) status.textContent = `Prüfung bestätigt. ${validation.blockers.length} Punkt${validation.blockers.length === 1 ? '' : 'e'} sind noch offen; der Export bleibt ein Entwurf.`;
  else status.textContent = 'Alles geprüft. Der lokale Entwurf kann für den offiziellen Dienst exportiert werden.';
}

function approveExport() {
  const validation = validateLocalApplicationPacket(latestPacket, reviewState);
  if (!validation.canApproveDraftForExport) return;
  latestPacket = { ...latestPacket, humanReview: { approvedAt: new Date().toISOString(), confirmations: { ...reviewState }, readyForOfficialServiceHandoff: validation.readyForOfficialServiceHandoff, submissionAllowed: false, statement: validation.boundary } };
  document.querySelector('#v03-export').classList.remove('hidden');
  const status = document.querySelector('#v03-approval-status');
  status.classList.add('approved');
  status.textContent = `${validation.readyForOfficialServiceHandoff ? 'Geprüft ✓ Bereit für den offiziellen Dienst.' : 'Geprüft ✓ Entwurf mit offenen Punkten freigegeben.'} Es wurde nichts versendet.`;
}

function exportPacket() {
  if (!latestPacket?.humanReview) return;
  const bundle = { exportedAt: new Date().toISOString(), product: 'Public Service Passport · Benefits v0.4', packet: latestPacket, explicitBoundary: 'LOCAL EXPORT ONLY — NOT SUBMITTED TO ANY AUTHORITY' };
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `public-service-passport-${latestPacket.service}-${latestPacket.packetId}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function registerV03Tools() {
  if (!document.modelContext?.registerTool) return;
  const tools = [
    {
      name: 'prepare_application_packet', title: 'Prepare a provenance-aware application packet',
      description: 'Prepare a browser-local draft using passport claims, local applicant details and human-marked evidence. Never submits or signs.',
      inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['kiz','wohngeld','but'] }, applicationDetails: { type: 'object' }, preparedEvidence: { type: 'array', items: { type: 'string' }, maxItems: 20 } }, required: ['service'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async (input = {}) => prepareLocalApplicationPacket(latestResult || await fetchResult(), input.service, { applicationDetails: input.applicationDetails || applicationDetails(), preparedEvidence: Array.isArray(input.preparedEvidence) ? input.preparedEvidence.slice(0, 20) : [...preparedEvidence] })
    },
    {
      name: 'validate_application_packet', title: 'Validate packet blockers and approval requirements',
      description: 'Report missing fields, evidence blockers and human-review requirements for a browser-local application packet. Never changes or submits it.',
      inputSchema: { type: 'object', properties: { service: { type: 'string', enum: ['kiz','wohngeld','but'] } }, required: ['service'], additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: async (input = {}) => validateLocalApplicationPacket(prepareLocalApplicationPacket(latestResult || await fetchResult(), input.service, { applicationDetails: applicationDetails(), preparedEvidence: [...preparedEvidence] }), reviewState)
    }
  ];
  for (const tool of tools) await document.modelContext.registerTool(tool);
  const pill = document.querySelector('#webmcp-status');
  if (pill) pill.innerHTML = '<span class="status-dot"></span>WebMCP · 11 read-only tools';
}

function observeBaseApp() {
  injectStudio();
  window.addEventListener('benefitbridge:result', (event) => { if (event.detail?.ok) setLatestResult(event.detail); });
  window.addEventListener('benefitbridge:evidence-changed', (event) => {
    preparedEvidence = new Set(Array.isArray(event.detail) ? event.detail.filter((id) => typeof id === 'string').slice(0, 20) : []);
    if (latestResult) { resetReview(); renderStudio(); }
  });
  const observer = new MutationObserver(() => {
    if (!latestResult && !document.querySelector('#passport-panel')?.classList.contains('hidden')) fetchResult().catch(console.error);
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
}

observeBaseApp();
setTimeout(() => registerV03Tools().catch(console.error), 300);
