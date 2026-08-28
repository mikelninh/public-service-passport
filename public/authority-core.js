const REQUIRED_CLAIMS = ['identity', 'children', 'income', 'rent', 'kindergeld_status'];

const BASE = {
  service: { id: 'kiz', label: 'Kinderzuschlag', jurisdiction: 'DE-BE' },
  citizen: { name: 'Mara Beispiel', household: 'Alleinerziehend · 2 Kinder', city: 'Berlin' },
  monthlyAmount: 287,
  authenticationLevel: 'high'
};

export const SCENARIOS = {
  clean: {
    id: 'clean',
    label: 'Sauberer Fast Path',
    summary: 'Alle entscheidungsrelevanten Fakten sind für diesen Demo-Scope source-verifiziert.',
    claims: [
      claim('identity', 'Mara Beispiel', 'source_verified', 'BundID/eID demo'),
      claim('children', '2 Kinder · 7 und 12 Jahre', 'source_verified', 'Register demo'),
      claim('income', 2000, 'source_verified', 'Einkommensquelle demo'),
      claim('rent', 1100, 'source_verified', 'Mietnachweis demo'),
      claim('kindergeld_status', true, 'source_verified', 'Leistungsquelle demo')
    ],
    evidence: [
      evidence('ev_identity', 'identity', 'verified'),
      evidence('ev_children', 'register', 'verified'),
      evidence('ev_income', 'database', 'verified'),
      evidence('ev_rent', 'document', 'verified'),
      evidence('ev_kindergeld', 'database', 'verified')
    ]
  },
  missing_income: {
    id: 'missing_income',
    label: 'Fehlender Einkommensnachweis',
    summary: 'Der Antrag ist fast vollständig, aber Einkommen ist bisher nur selbst angegeben.',
    claims: [
      claim('identity', 'Mara Beispiel', 'source_verified', 'BundID/eID demo'),
      claim('children', '2 Kinder · 7 und 12 Jahre', 'source_verified', 'Register demo'),
      claim('income', 2000, 'self_attested', 'Bürgerangabe'),
      claim('rent', 1100, 'source_verified', 'Mietnachweis demo'),
      claim('kindergeld_status', true, 'source_verified', 'Leistungsquelle demo')
    ],
    evidence: [
      evidence('ev_identity', 'identity', 'verified'),
      evidence('ev_children', 'register', 'verified'),
      evidence('ev_income', 'database', 'missing'),
      evidence('ev_rent', 'document', 'verified'),
      evidence('ev_kindergeld', 'database', 'verified')
    ]
  },
  rent_conflict: {
    id: 'rent_conflict',
    label: 'Widerspruch bei der Miete',
    summary: 'Eingabe und Nachweis widersprechen sich. Der Fall muss stoppen, bis der Konflikt geklärt ist.',
    claims: [
      claim('identity', 'Mara Beispiel', 'source_verified', 'BundID/eID demo'),
      claim('children', '2 Kinder · 7 und 12 Jahre', 'source_verified', 'Register demo'),
      claim('income', 2000, 'source_verified', 'Einkommensquelle demo'),
      claim('rent', 1100, 'document_backed', 'Bürgerangabe + Dokument'),
      claim('kindergeld_status', true, 'source_verified', 'Leistungsquelle demo')
    ],
    evidence: [
      evidence('ev_identity', 'identity', 'verified'),
      evidence('ev_children', 'register', 'verified'),
      evidence('ev_income', 'database', 'verified'),
      { ...evidence('ev_rent', 'document', 'conflicting'), note: 'Antrag: 1.100 € · Nachweis: 950 €' },
      evidence('ev_kindergeld', 'database', 'verified')
    ]
  },
  expired_identity: {
    id: 'expired_identity',
    label: 'Abgelaufener Identitätsnachweis',
    summary: 'Die Angaben sind vollständig, aber ein entscheidungsrelevanter Proof ist nicht mehr gültig.',
    claims: [
      claim('identity', 'Mara Beispiel', 'document_backed', 'abgelaufener Proof'),
      claim('children', '2 Kinder · 7 und 12 Jahre', 'source_verified', 'Register demo'),
      claim('income', 2000, 'source_verified', 'Einkommensquelle demo'),
      claim('rent', 1100, 'source_verified', 'Mietnachweis demo'),
      claim('kindergeld_status', true, 'source_verified', 'Leistungsquelle demo')
    ],
    evidence: [
      { ...evidence('ev_identity', 'identity', 'expired'), note: 'Proof abgelaufen' },
      evidence('ev_children', 'register', 'verified'),
      evidence('ev_income', 'database', 'verified'),
      evidence('ev_rent', 'document', 'verified'),
      evidence('ev_kindergeld', 'database', 'verified')
    ]
  }
};

function claim(id, value, verificationTier, source) {
  return { id, value, verificationTier, source };
}

function evidence(id, kind, status) {
  return { id, kind, status, source: 'synthetic-authoritative-source' };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stamp(caseFile, type, label, detail = '') {
  const seq = caseFile.events.length + 1;
  caseFile.events.push({ seq, type, label, detail, at: `T+${seq}` });
}

export function createAuthorityCase(scenarioId = 'clean') {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`);
  const seed = `${scenarioId}|${JSON.stringify(scenario.claims)}|${JSON.stringify(scenario.evidence)}`;
  const caseFile = {
    version: 'authority-workbench/0.1',
    synthetic: true,
    caseId: `ac_${hashText(seed)}`,
    correlationId: `corr_${hashText(`corr|${seed}`)}`,
    scenarioId,
    scenarioLabel: scenario.label,
    scenarioSummary: scenario.summary,
    service: clone(BASE.service),
    citizen: clone(BASE.citizen),
    monthlyAmount: BASE.monthlyAmount,
    authenticationLevel: BASE.authenticationLevel,
    claims: clone(scenario.claims),
    evidence: clone(scenario.evidence),
    state: 'received_by_authority',
    preflight: null,
    decision: { status: 'not_started', receipt: null },
    payment: { status: 'not_started', receipt: null },
    transportReceipt: `tr_${hashText(`transport|${seed}`)}`,
    manualTouches: 0,
    events: []
  };
  stamp(caseFile, 'transport', 'Antrag bei Behörde eingegangen', `Transport-Receipt ${caseFile.transportReceipt}`);
  return caseFile;
}

export function sourceVerifiedRatio(caseFile) {
  if (!caseFile.claims.length) return 0;
  const verified = caseFile.claims.filter((item) => item.verificationTier === 'source_verified' || item.verificationTier === 'authority_verified').length;
  return verified / caseFile.claims.length;
}

export function runAuthorityPreflight(input) {
  const caseFile = clone(input);
  const exceptions = [];

  for (const required of REQUIRED_CLAIMS) {
    const item = caseFile.claims.find((claimItem) => claimItem.id === required);
    if (!item) {
      exceptions.push({ code: `missing_claim:${required}`, label: `Pflichtangabe fehlt: ${required}` });
      continue;
    }
    if (!['source_verified', 'authority_verified'].includes(item.verificationTier)) {
      exceptions.push({ code: `claim_not_source_verified:${required}`, label: `${humanClaim(required)} ist noch nicht source-verifiziert.` });
    }
  }

  for (const item of caseFile.evidence) {
    if (item.status === 'missing') exceptions.push({ code: `evidence_missing:${item.id}`, label: `Nachweis fehlt: ${humanEvidence(item.id)}` });
    if (item.status === 'conflicting') exceptions.push({ code: `evidence_conflict:${item.id}`, label: `Widerspruch: ${item.note || humanEvidence(item.id)}` });
    if (item.status === 'expired') exceptions.push({ code: `evidence_expired:${item.id}`, label: `Nachweis abgelaufen: ${humanEvidence(item.id)}` });
  }

  caseFile.preflight = {
    schemaValid: true,
    deterministicRecalculation: 'matched',
    duplicateCheck: 'clear',
    sourceVerifiedRatio: sourceVerifiedRatio(caseFile),
    exceptions,
    automatedChecks: 6
  };
  caseFile.state = exceptions.length ? 'in_review' : 'ready_for_decision';
  if (exceptions.length) caseFile.manualTouches += 1;
  stamp(
    caseFile,
    'preflight',
    exceptions.length ? `${exceptions.length} Ausnahme(n) gefunden` : 'Automatischer Preflight ohne Ausnahme',
    exceptions.length ? 'Nur offene Punkte gehen in die manuelle Prüfung.' : 'Fall ist entscheidungsbereit.'
  );
  return caseFile;
}

export function resolveSyntheticExceptions(input) {
  const caseFile = clone(input);
  if (caseFile.state !== 'in_review') throw new Error('Case is not in exception review.');

  for (const claimItem of caseFile.claims) {
    if (!['source_verified', 'authority_verified'].includes(claimItem.verificationTier)) {
      claimItem.verificationTier = 'source_verified';
      claimItem.source = 'synthetic resolved authoritative source';
      if (claimItem.id === 'rent' && caseFile.scenarioId === 'rent_conflict') claimItem.value = 950;
    }
  }
  for (const item of caseFile.evidence) {
    if (['missing', 'conflicting', 'expired'].includes(item.status)) {
      item.status = 'verified';
      item.note = 'Synthetic exception resolved';
    }
  }
  stamp(caseFile, 'human_review', 'Offene Ausnahme geklärt', 'Synthetischer Proof wurde ersetzt/verifiziert.');
  return runAuthorityPreflight(caseFile);
}

export function makeAuthorityDecision(input, decision = 'approved') {
  const caseFile = clone(input);
  if (caseFile.state !== 'ready_for_decision') throw new Error('Case is not ready for authority decision.');
  if (!['approved', 'rejected'].includes(decision)) throw new Error('Unsupported decision.');

  const evidenceSnapshot = caseFile.evidence.map(({ id, status }) => `${id}:${status}`).join('|');
  const receipt = {
    id: `oar_${hashText(`${caseFile.caseId}|${decision}|${evidenceSnapshot}`)}`,
    decision,
    authority: 'Synthetic Familienkasse reviewer',
    evidenceSnapshotHash: hashText(evidenceSnapshot),
    amount: decision === 'approved' ? caseFile.monthlyAmount : null,
    conditions: [],
    synthetic: true
  };
  caseFile.decision = { status: decision, receipt };
  caseFile.state = decision === 'approved' ? 'decision_approved' : 'decision_rejected';
  caseFile.manualTouches += 1;
  stamp(caseFile, 'decision', decision === 'approved' ? 'Bewilligung erteilt' : 'Antrag abgelehnt', `Decision-Receipt ${receipt.id}`);
  return caseFile;
}

export function instructPayment(input) {
  const caseFile = clone(input);
  if (caseFile.state !== 'decision_approved') throw new Error('Payment requires an approved authority decision.');
  const receipt = `payi_${hashText(`${caseFile.caseId}|instruction|${caseFile.monthlyAmount}`)}`;
  caseFile.payment = { status: 'instructed', amount: caseFile.monthlyAmount, receipt };
  caseFile.state = 'payment_instructed';
  stamp(caseFile, 'payment', 'Auszahlung angewiesen', `Payment instruction ${receipt}`);
  return caseFile;
}

export function sendPayment(input) {
  const caseFile = clone(input);
  if (caseFile.state !== 'payment_instructed') throw new Error('Payment must be instructed first.');
  caseFile.payment.status = 'sent';
  caseFile.state = 'payment_sent';
  stamp(caseFile, 'payment', 'Zahlung an Bank übergeben', 'Synthetische Zahlungsreferenz erzeugt.');
  return caseFile;
}

export function settlePayment(input) {
  const caseFile = clone(input);
  if (caseFile.state !== 'payment_sent') throw new Error('Payment must be sent before settlement.');
  caseFile.payment.status = 'settled';
  caseFile.payment.receipt = `pays_${hashText(`${caseFile.caseId}|settled|${caseFile.monthlyAmount}`)}`;
  caseFile.state = 'paid';
  stamp(caseFile, 'payment', 'Geld ausgezahlt', `Settlement-Receipt ${caseFile.payment.receipt}`);
  return caseFile;
}

export function reconcilePayment(input) {
  const caseFile = clone(input);
  if (caseFile.state !== 'paid') throw new Error('Only a settled payment can be reconciled.');
  caseFile.payment.status = 'reconciled';
  caseFile.state = 'reconciled';
  stamp(caseFile, 'reconciliation', 'Fall finanziell abgeglichen', 'Zahlung und bewilligter Betrag stimmen überein.');
  return caseFile;
}

export function citizenTimeline(caseFile) {
  const order = [
    ['received_by_authority', 'Antrag eingegangen'],
    ['ready_for_decision', 'Nachweise geprüft'],
    ['decision_approved', 'Bewilligt'],
    ['payment_instructed', 'Auszahlung angewiesen'],
    ['payment_sent', 'Zahlung unterwegs'],
    ['paid', 'Geld ausgezahlt'],
    ['reconciled', 'Fall abgeschlossen']
  ];
  const reached = new Set();
  reached.add('received_by_authority');
  if (caseFile.preflight && caseFile.preflight.exceptions.length === 0) reached.add('ready_for_decision');
  if (['decision_approved', 'payment_instructed', 'payment_sent', 'paid', 'reconciled'].includes(caseFile.state)) {
    reached.add('ready_for_decision');
    reached.add('decision_approved');
  }
  if (['payment_instructed', 'payment_sent', 'paid', 'reconciled'].includes(caseFile.state)) reached.add('payment_instructed');
  if (['payment_sent', 'paid', 'reconciled'].includes(caseFile.state)) reached.add('payment_sent');
  if (['paid', 'reconciled'].includes(caseFile.state)) reached.add('paid');
  if (caseFile.state === 'reconciled') reached.add('reconciled');
  return order.map(([id, label]) => ({ id, label, done: reached.has(id) }));
}

function humanClaim(id) {
  return ({ identity: 'Identität', children: 'Kinder/Haushalt', income: 'Einkommen', rent: 'Miete', kindergeld_status: 'Kindergeldstatus' })[id] || id;
}

function humanEvidence(id) {
  return ({ ev_identity: 'Identität', ev_children: 'Haushalt/Kinder', ev_income: 'Einkommen', ev_rent: 'Miete', ev_kindergeld: 'Kindergeld' })[id] || id;
}
