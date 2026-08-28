import {
  SCENARIOS,
  createAuthorityCase,
  runAuthorityPreflight,
  resolveSyntheticExceptions,
  makeAuthorityDecision,
  instructPayment,
  sendPayment,
  settlePayment,
  reconcilePayment,
  citizenTimeline,
  sourceVerifiedRatio
} from './authority-core.js';

const els = {
  scenarioGrid: document.querySelector('#scenarioGrid'),
  verifiedRatio: document.querySelector('#verifiedRatio'),
  autoChecks: document.querySelector('#autoChecks'),
  exceptionCount: document.querySelector('#exceptionCount'),
  manualTouches: document.querySelector('#manualTouches'),
  citizenStatus: document.querySelector('#citizenStatus'),
  authorityStatus: document.querySelector('#authorityStatus'),
  citizenTimeline: document.querySelector('#citizenTimeline'),
  moneyAmount: document.querySelector('#moneyAmount'),
  caseId: document.querySelector('#caseId'),
  transportReceipt: document.querySelector('#transportReceipt'),
  scenarioLabel: document.querySelector('#scenarioLabel'),
  proofList: document.querySelector('#proofList'),
  exceptionBox: document.querySelector('#exceptionBox'),
  exceptions: document.querySelector('#exceptions'),
  nextAction: document.querySelector('#nextAction'),
  rejectAction: document.querySelector('#rejectAction'),
  resetAction: document.querySelector('#resetAction'),
  actionNote: document.querySelector('#actionNote'),
  eventLedger: document.querySelector('#eventLedger')
};

let currentScenario = 'clean';
let caseFile = createAuthorityCase(currentScenario);

const CLAIM_LABELS = {
  identity: 'Identität',
  children: 'Kinder / Haushalt',
  income: 'Bruttoeinkommen',
  rent: 'Warmmiete',
  kindergeld_status: 'Kindergeldstatus'
};

const TIER_LABELS = {
  self_attested: 'selbst angegeben',
  document_backed: 'Dokument vorhanden',
  source_verified: 'source-verifiziert',
  authority_verified: 'behördlich verifiziert'
};

function formatValue(item) {
  if (item.id === 'income' || item.id === 'rent') return `${Number(item.value).toLocaleString('de-DE')} €`;
  if (typeof item.value === 'boolean') return item.value ? 'Ja' : 'Nein';
  return String(item.value);
}

function setText(node, value) {
  node.textContent = value;
}

function render() {
  const ratio = Math.round(sourceVerifiedRatio(caseFile) * 100);
  setText(els.verifiedRatio, `${ratio}%`);
  setText(els.autoChecks, String(caseFile.preflight?.automatedChecks || 0));
  setText(els.exceptionCount, caseFile.preflight ? String(caseFile.preflight.exceptions.length) : '—');
  setText(els.manualTouches, String(caseFile.manualTouches));
  setText(els.caseId, caseFile.caseId);
  setText(els.transportReceipt, caseFile.transportReceipt);
  setText(els.scenarioLabel, caseFile.scenarioLabel);
  setText(els.citizenStatus, citizenStatus(caseFile));
  setText(els.authorityStatus, authorityStatus(caseFile));

  renderTimeline();
  renderProofs();
  renderExceptions();
  renderMoney();
  renderLedger();
  renderActions();
}

function renderTimeline() {
  els.citizenTimeline.replaceChildren();
  const items = citizenTimeline(caseFile);
  const firstPending = items.findIndex((item) => !item.done);
  items.forEach((item, index) => {
    const li = document.createElement('li');
    if (item.done) li.classList.add('done');
    else if (index === firstPending) li.classList.add('current');

    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.textContent = item.done ? '✓' : index === firstPending ? '•' : '';

    const body = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.label;
    const small = document.createElement('small');
    small.textContent = timelineHint(item.id);
    body.append(strong, small);
    li.append(dot, body);
    els.citizenTimeline.append(li);
  });
}

function renderProofs() {
  els.proofList.replaceChildren();
  for (const item of caseFile.claims) {
    const row = document.createElement('div');
    row.className = 'proof-row';

    const name = document.createElement('span');
    name.className = 'claim-name';
    name.textContent = CLAIM_LABELS[item.id] || item.id;

    const value = document.createElement('span');
    value.className = 'claim-value';
    value.textContent = formatValue(item);

    const source = document.createElement('span');
    source.className = 'claim-source';
    source.textContent = item.source;

    const tier = document.createElement('span');
    tier.className = `tier ${item.verificationTier}`;
    tier.textContent = TIER_LABELS[item.verificationTier] || item.verificationTier;

    row.append(name, value, source, tier);
    els.proofList.append(row);
  }
}

function renderExceptions() {
  els.exceptions.replaceChildren();
  const exceptions = caseFile.preflight?.exceptions;
  els.exceptionBox.classList.toggle('has-exceptions', Boolean(exceptions?.length));

  if (!caseFile.preflight) {
    els.exceptions.textContent = 'Preflight noch nicht gestartet.';
    return;
  }

  if (!exceptions.length) {
    const good = document.createElement('div');
    good.className = 'exception-good';
    good.textContent = '✓ Keine offene Ausnahme. Der Fall ist für eine Behördenentscheidung vorbereitet.';
    els.exceptions.append(good);
    return;
  }

  const list = document.createElement('div');
  list.className = 'exception-list';
  for (const item of exceptions) {
    const row = document.createElement('div');
    row.className = 'exception-item';
    row.textContent = item.label;
    list.append(row);
  }
  els.exceptions.append(list);
}

function renderMoney() {
  if (caseFile.decision.status === 'approved') {
    const suffix = caseFile.payment.status === 'settled' || caseFile.payment.status === 'reconciled' ? ' · ausgezahlt' : ' · bewilligt';
    setText(els.moneyAmount, `${caseFile.monthlyAmount.toLocaleString('de-DE')} € / Monat${suffix}`);
  } else if (caseFile.decision.status === 'rejected') {
    setText(els.moneyAmount, 'Antrag abgelehnt');
  } else {
    setText(els.moneyAmount, 'Noch keine Entscheidung');
  }
}

function renderLedger() {
  els.eventLedger.replaceChildren();
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
    els.eventLedger.append(row);
  }
}

function renderActions() {
  els.rejectAction.hidden = caseFile.state !== 'ready_for_decision';
  els.nextAction.disabled = caseFile.state === 'decision_rejected';

  const map = {
    received_by_authority: ['Automatischen Preflight starten', '6 maschinelle Checks: Schema, Proofs, Widersprüche, Duplikate und Regelabgleich.'],
    in_review: ['Offenen Punkt synthetisch klären', 'In Produktion käme hier ein echter Nachweis / Registertreffer oder eine menschliche Klärung.'],
    ready_for_decision: ['Bewilligung simulieren', 'Die Entscheidung bleibt ein eigener, verantwortlicher Behördenakt.'],
    decision_approved: ['Auszahlung anweisen', 'Ab hier übernimmt das autoritative Fach-/Finanzsystem.'],
    payment_instructed: ['Zahlung an Bank übergeben', 'Zahlungsanweisung und tatsächliche Zahlung bleiben getrennte Zustände.'],
    payment_sent: ['Settlement bestätigen', 'Erst ein Settlement-Receipt bedeutet: Geld ist ausgezahlt.'],
    paid: ['Fall abgleichen', 'Letzter Schritt: bewilligter Betrag und tatsächliche Zahlung werden reconciled.'],
    reconciled: ['Demo erneut starten', 'End-to-End abgeschlossen: Antrag → Proofs → Entscheidung → Geld → Abgleich.'],
    decision_rejected: ['Abgelehnt', 'Bei Ablehnung wird keine Auszahlung gestartet.']
  };
  const [label, note] = map[caseFile.state] || ['Weiter', ''];
  setText(els.nextAction, label);
  setText(els.actionNote, `${note} Keine Aktion geht an eine echte Behörde oder Bank.`);
}

function citizenStatus(value) {
  if (value.state === 'in_review') return 'Rückfrage nötig';
  if (value.state === 'ready_for_decision') return 'Prüfung abgeschlossen';
  if (value.state === 'decision_approved') return 'Bewilligt';
  if (value.state === 'decision_rejected') return 'Abgelehnt';
  if (value.state === 'payment_instructed') return 'Auszahlung angewiesen';
  if (value.state === 'payment_sent') return 'Zahlung unterwegs';
  if (value.state === 'paid') return 'Ausgezahlt';
  if (value.state === 'reconciled') return 'Abgeschlossen';
  return 'Eingegangen';
}

function authorityStatus(value) {
  if (value.state === 'in_review') return 'Ausnahme prüfen';
  if (value.state === 'ready_for_decision') return 'Entscheidungsbereit';
  if (value.state === 'decision_approved') return 'Bewilligt';
  if (value.state === 'decision_rejected') return 'Abgelehnt';
  if (value.state.startsWith('payment_')) return 'Finanzsystem';
  if (value.state === 'paid') return 'Settlement';
  if (value.state === 'reconciled') return 'Reconciled';
  return 'Neu eingegangen';
}

function timelineHint(id) {
  const hints = {
    received_by_authority: 'Transport-Receipt bestätigt den Eingang.',
    ready_for_decision: 'Proofs und Regeln wurden geprüft; offene Ausnahmen sind geklärt.',
    decision_approved: 'Erst der Behörden-Receipt macht aus Prüfung eine Entscheidung.',
    payment_instructed: 'Die Behörde hat eine Zahlungsanweisung erzeugt.',
    payment_sent: 'Die Zahlung wurde an das Bank-/Zahlungssystem übergeben.',
    paid: 'Settlement bestätigt die tatsächliche Auszahlung.',
    reconciled: 'Bewilligung und Zahlung sind abgeglichen.'
  };
  return hints[id] || '';
}

function selectScenario(id) {
  currentScenario = id;
  caseFile = createAuthorityCase(id);
  for (const button of els.scenarioGrid.querySelectorAll('[data-scenario]')) {
    button.classList.toggle('active', button.dataset.scenario === id);
  }
  render();
}

els.scenarioGrid.addEventListener('click', (event) => {
  const button = event.target.closest('[data-scenario]');
  if (!button) return;
  selectScenario(button.dataset.scenario);
});

els.nextAction.addEventListener('click', () => {
  try {
    if (caseFile.state === 'received_by_authority') caseFile = runAuthorityPreflight(caseFile);
    else if (caseFile.state === 'in_review') caseFile = resolveSyntheticExceptions(caseFile);
    else if (caseFile.state === 'ready_for_decision') caseFile = makeAuthorityDecision(caseFile, 'approved');
    else if (caseFile.state === 'decision_approved') caseFile = instructPayment(caseFile);
    else if (caseFile.state === 'payment_instructed') caseFile = sendPayment(caseFile);
    else if (caseFile.state === 'payment_sent') caseFile = settlePayment(caseFile);
    else if (caseFile.state === 'paid') caseFile = reconcilePayment(caseFile);
    else if (caseFile.state === 'reconciled') caseFile = createAuthorityCase(currentScenario);
    render();
  } catch (error) {
    setText(els.actionNote, `Gestoppt: ${error.message}`);
  }
});

els.rejectAction.addEventListener('click', () => {
  try {
    caseFile = makeAuthorityDecision(caseFile, 'rejected');
    render();
  } catch (error) {
    setText(els.actionNote, `Gestoppt: ${error.message}`);
  }
});

els.resetAction.addEventListener('click', () => {
  caseFile = createAuthorityCase(currentScenario);
  render();
});

if (!SCENARIOS[currentScenario]) currentScenario = Object.keys(SCENARIOS)[0];
render();
