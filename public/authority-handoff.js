import { CITIZEN_AUTHORITY_HANDOFF_STORAGE_KEY, parseCitizenAuthorityHandoff } from './case-handoff.js';
import { createAuthorityCaseFromCitizenHandoff } from './citizen-authority-case.js';
import { runAuthorityPreflight, citizenTimeline, sourceVerifiedRatio } from './authority-core.js';

const params = new URLSearchParams(window.location.search);
if (params.get('source') === 'citizen') bootstrapCitizenPreview();

function bootstrapCitizenPreview() {
  const raw = localStorage.getItem(CITIZEN_AUTHORITY_HANDOFF_STORAGE_KEY);
  localStorage.removeItem(CITIZEN_AUTHORITY_HANDOFF_STORAGE_KEY);

  let handoff;
  try {
    handoff = parseCitizenAuthorityHandoff(raw, { now: Date.now() });
  } catch (error) {
    showBoundaryBanner(`Der lokale Bürger-Handoff fehlt oder ist abgelaufen (${error.message}).`, true);
    document.querySelector('.scenario-panel')?.setAttribute('hidden', '');
    document.querySelector('.workspace')?.setAttribute('hidden', '');
    return;
  }

  let caseFile = createAuthorityCaseFromCitizenHandoff(handoff, { now: Date.now() });
  document.querySelector('.scenario-panel')?.setAttribute('hidden', '');
  showBoundaryBanner('Lokaler Bürger-Testfall geladen. Die Daten wurden nicht an eine Behörde gesendet. Selbstangaben bleiben Selbstangaben.');

  const citizenCard = document.querySelector('.citizen-card');
  if (citizenCard) {
    citizenCard.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = 'Lokaler Bürger-Testfall';
    const household = document.createElement('span');
    household.textContent = `${caseFile.citizen.household} · Berlin`;
    const service = document.createElement('span');
    service.textContent = 'Kinderzuschlag · nur Test-Handoff';
    citizenCard.append(title, household, service);
  }

  const labels = {
    identity: 'Identität',
    children: 'Kinder / Haushalt',
    income: 'Bruttoeinkommen',
    rent: 'Warmmiete',
    kindergeld_status: 'Kindergeldstatus'
  };
  const nextAction = document.querySelector('#nextAction');
  const rejectAction = document.querySelector('#rejectAction');
  const resetAction = document.querySelector('#resetAction');
  if (rejectAction) rejectAction.hidden = true;

  document.addEventListener('click', (event) => {
    if (event.target === nextAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (caseFile.state !== 'received_by_authority') return;
      caseFile = runAuthorityPreflight(caseFile);
      renderImported();
    }
    if (event.target === resetAction) {
      event.preventDefault();
      event.stopImmediatePropagation();
      window.location.assign('/authority.html');
    }
  }, true);

  function renderImported() {
    setText('#verifiedRatio', `${Math.round(sourceVerifiedRatio(caseFile) * 100)}%`);
    setText('#autoChecks', String(caseFile.preflight?.automatedChecks || 0));
    setText('#exceptionCount', caseFile.preflight ? String(caseFile.preflight.exceptions.length) : '—');
    setText('#manualTouches', String(caseFile.manualTouches));
    setText('#caseId', caseFile.caseId);
    setText('#transportReceipt', caseFile.transportReceipt);
    setText('#scenarioLabel', caseFile.scenarioLabel);
    setText('#citizenStatus', caseFile.preflight ? 'Nachweise fehlen' : 'Lokal übernommen');
    setText('#authorityStatus', caseFile.preflight ? 'Ausnahme prüfen' : 'Test-Handoff');
    setText('#moneyAmount', 'Keine Behördenentscheidung');

    const proofList = document.querySelector('#proofList');
    if (proofList) {
      proofList.replaceChildren();
      renderProofRow(proofList, { id: 'identity', value: 'nicht erfasst', source: 'kein Identitätsnachweis', verificationTier: 'self_attested' }, labels);
      for (const item of caseFile.claims) renderProofRow(proofList, item, labels);
    }

    const exceptions = document.querySelector('#exceptions');
    const box = document.querySelector('#exceptionBox');
    if (exceptions) {
      exceptions.replaceChildren();
      if (!caseFile.preflight) {
        exceptions.textContent = 'Preflight noch nicht gestartet. Alle übernommenen Werte sind weiterhin selbst angegeben.';
      } else {
        box?.classList.add('has-exceptions');
        const list = document.createElement('div');
        list.className = 'exception-list';
        for (const item of caseFile.preflight.exceptions) {
          const row = document.createElement('div');
          row.className = 'exception-item';
          row.textContent = item.label;
          list.append(row);
        }
        exceptions.append(list);
      }
    }

    renderTimeline(caseFile);
    renderLedger(caseFile);

    if (nextAction) {
      if (!caseFile.preflight) {
        nextAction.disabled = false;
        nextAction.textContent = 'Preflight für diesen Testfall starten';
      } else {
        nextAction.disabled = true;
        nextAction.textContent = 'Nachweise erforderlich';
      }
    }
    setText('#actionNote', caseFile.preflight
      ? 'Der Fall bleibt absichtlich im Exception Path. v1.0 darf Selbstangaben nicht automatisch in source-verifizierte Fakten umwandeln.'
      : 'Der Preflight prüft denselben Fall wie der 100-Fälle-Pilot. Keine Aktion geht an eine echte Behörde oder Bank.');
  }

  renderImported();
}

function renderProofRow(root, item, labels) {
  const row = document.createElement('div');
  row.className = 'proof-row';
  const name = document.createElement('span');
  name.className = 'claim-name';
  name.textContent = labels[item.id] || item.id;
  const value = document.createElement('span');
  value.className = 'claim-value';
  value.textContent = item.id === 'income' || item.id === 'rent'
    ? `${Number(item.value).toLocaleString('de-DE')} €`
    : typeof item.value === 'boolean' ? (item.value ? 'Ja' : 'Nein') : String(item.value);
  const source = document.createElement('span');
  source.className = 'claim-source';
  source.textContent = item.source;
  const tier = document.createElement('span');
  tier.className = 'tier self_attested';
  tier.textContent = 'selbst angegeben';
  row.append(name, value, source, tier);
  root.append(row);
}

function renderTimeline(caseFile) {
  const root = document.querySelector('#citizenTimeline');
  if (!root) return;
  root.replaceChildren();
  for (const item of citizenTimeline(caseFile)) {
    const li = document.createElement('li');
    if (item.done) li.classList.add('done');
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = item.done ? '✓' : '';
    const body = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.label;
    const small = document.createElement('small');
    small.textContent = item.id === 'received_by_authority'
      ? 'Nur lokal geöffnet — kein echter Behördeneingang.'
      : 'Noch nicht erreicht.';
    body.append(strong, small);
    li.append(dot, body);
    root.append(li);
  }
}

function renderLedger(caseFile) {
  const root = document.querySelector('#eventLedger');
  if (!root) return;
  root.replaceChildren();
  for (const event of caseFile.events.slice().reverse()) {
    const row = document.createElement('div');
    row.className = 'ledger-row';
    const seq = document.createElement('span');
    seq.textContent = `#${event.seq}`;
    const at = document.createElement('span');
    at.textContent = event.at;
    const label = document.createElement('strong');
    label.textContent = event.label;
    const detail = document.createElement('p');
    detail.textContent = event.detail;
    row.append(seq, at, label, detail);
    root.append(row);
  }
}

function showBoundaryBanner(message, error = false) {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const banner = document.createElement('section');
  banner.id = 'citizen-handoff-banner';
  banner.className = 'principle-card';
  banner.setAttribute('role', error ? 'alert' : 'status');
  const strong = document.createElement('strong');
  strong.textContent = error ? 'Handoff nicht geladen' : 'Bürger → Behörde: lokaler Test-Handoff';
  const p = document.createElement('p');
  p.textContent = message;
  const link = document.createElement('a');
  link.href = '/';
  link.textContent = '← Zur Bürgeransicht';
  banner.append(strong, p, link);
  hero.insertAdjacentElement('afterend', banner);
}

function setText(selector, value) {
  const node = document.querySelector(selector);
  if (node) node.textContent = value;
}
