import { runSyntheticAuthorityPilot } from './pilot-core.js';

const report = runSyntheticAuthorityPilot();
const pct = (value) => `${Math.round(value * 100)}%`;
const byId = (id) => document.getElementById(id);

byId('m-total').textContent = report.cohort.total;
byId('m-fast').textContent = report.routing.initialFastPath;
byId('m-exception').textContent = report.routing.initialExceptionPath;
byId('m-routing').textContent = pct(report.routing.routeAccuracy);
byId('m-proof').textContent = pct(report.proofQuality.averageInitialSourceVerifiedRatio);
byId('m-payment').textContent = report.integrity.everyRejectedPaymentAttemptBlocked && report.integrity.everyApprovalSettled ? '100%' : 'FEHLER';

for (const profile of report.cohort.profiles) {
  const card = document.createElement('article');
  const count = document.createElement('strong');
  const label = document.createElement('span');
  count.textContent = profile.count;
  label.textContent = profile.label;
  card.append(count, label);
  byId('cohort-grid').append(card);
}

for (const item of report.topBlockers) {
  const row = document.createElement('div');
  const left = document.createElement('div');
  const code = document.createElement('strong');
  const bar = document.createElement('span');
  const count = document.createElement('b');
  code.textContent = humanBlocker(item.code);
  bar.className = 'bar';
  bar.style.setProperty('--width', `${Math.max(8, (item.count / report.topBlockers[0].count) * 100)}%`);
  count.textContent = `${item.count} Fälle`;
  left.append(code, bar);
  row.append(left, count);
  byId('blockers').append(row);
}

const integrityLabels = [
  ['allCasesRoutedAsExpected', '100 Fälle korrekt in Fast Path oder Ausnahme geroutet'],
  ['allExceptionCodesMatchedGroundTruth', 'Alle erwarteten Ausnahmegründe exakt erkannt'],
  ['allCasesReachedDecision', 'Alle Ausnahmen nach synthetischer Klärung entscheidungsbereit'],
  ['everyApprovalSettled', 'Jede synthetische Bewilligung bis Settlement durchgelaufen'],
  ['everySettlementReconciled', 'Jedes Settlement finanziell abgeglichen'],
  ['everyRejectedPaymentAttemptBlocked', 'Jeder Zahlungsversuch nach Ablehnung blockiert']
];
for (const [key, label] of integrityLabels) {
  const row = document.createElement('div');
  const mark = document.createElement('span');
  const text = document.createElement('strong');
  mark.textContent = report.integrity[key] ? '✓' : '×';
  mark.className = report.integrity[key] ? 'ok' : 'bad';
  text.textContent = label;
  row.append(mark, text);
  byId('integrity').append(row);
}

byId('w-base').textContent = report.workloadModel.baselineManualTouches;
byId('w-model').textContent = report.workloadModel.modeledManualTouches;
byId('w-avoided').textContent = report.workloadModel.avoidedManualTouches;
byId('w-reduction').textContent = `${pct(report.workloadModel.modeledTouchReduction)} weniger im Modell`;
byId('workload-note').textContent = `${report.workloadModel.assumptions.baselineDefinition} Diese Annahme ist transparent konfiguriert; es wurde keine reale Bearbeitungszeit einer Behörde gemessen.`;

let activeFilter = 'all';
function renderCases() {
  const body = byId('case-table');
  body.textContent = '';
  const filtered = report.cases.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'decision_rejected') return item.finalState === 'decision_rejected';
    return item.initialRoute === activeFilter;
  });
  for (const item of filtered) {
    const tr = document.createElement('tr');
    const values = [
      item.caseId,
      profileLabel(item.profileId),
      item.initialRoute === 'ready_for_decision' ? 'Fast Path' : 'Ausnahme',
      pct(item.sourceVerifiedRatio),
      item.decision === 'approved' ? 'bewilligt' : 'abgelehnt',
      item.finalState === 'reconciled' ? 'ausgezahlt + reconciled' : 'abgelehnt',
      String(item.manualTouches)
    ];
    for (const value of values) {
      const td = document.createElement('td');
      td.textContent = value;
      tr.append(td);
    }
    body.append(tr);
  }
}

for (const button of document.querySelectorAll('.filter')) {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    for (const other of document.querySelectorAll('.filter')) other.classList.toggle('active', other === button);
    renderCases();
  });
}
renderCases();

function profileLabel(id) {
  return report.cohort.profiles.find((item) => item.id === id)?.label || id;
}

function humanBlocker(code) {
  const labels = {
    'claim_not_source_verified:income': 'Einkommen noch nicht source-verifiziert',
    'evidence_missing:ev_income': 'Einkommensnachweis fehlt',
    'claim_not_source_verified:rent': 'Miete noch nicht source-verifiziert',
    'evidence_conflict:ev_rent': 'Mietnachweis widersprüchlich',
    'claim_not_source_verified:children': 'Kinder/Haushalt noch nicht source-verifiziert',
    'evidence_missing:ev_children': 'Kinder-/Haushaltsnachweis fehlt',
    'claim_not_source_verified:identity': 'Identität noch nicht source-verifiziert',
    'evidence_expired:ev_identity': 'Identitäts-Proof abgelaufen',
    'claim_not_source_verified:kindergeld_status': 'Kindergeldstatus noch nicht source-verifiziert',
    'evidence_missing:ev_kindergeld': 'Kindergeld-Proof fehlt'
  };
  return labels[code] || code;
}
