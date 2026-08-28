import crypto from 'node:crypto';

export const POLICY_VERSION = 'DE-2026-08-27-passport-v02';

export const SOURCES = {
  kindergeld: {
    label: 'Bundesagentur für Arbeit — Kindergeld 2026',
    url: 'https://www.arbeitsagentur.de/news/kindergeld-steigt-2026',
    fact: '€259 per eligible child per month from January 2026.'
  },
  kiz: {
    label: 'Bundesagentur für Arbeit — Kinderzuschlag',
    url: 'https://www.arbeitsagentur.de/familie-und-kinder/kinderzuschlag-verstehen/kiz-lotse',
    fact: 'KiZ is up to €297 per child per month. The KiZ-Lotse asks about children, basic-security receipt, income and rent; it does not calculate the final KiZ amount.'
  },
  wohngeld: {
    label: 'Service Berlin — Wohngeld Mietzuschuss',
    url: 'https://service.berlin.de/dienstleistung/120656/',
    fact: 'Wohngeld applications commonly require income evidence, rental documents and recent rent-payment evidence. This demo does not reproduce the statutory calculation.'
  },
  but: {
    label: 'BMAS — Bildung und Teilhabe 2026',
    url: 'https://www.bmas.de/DE/Arbeit/Grundsicherung-fuer-Arbeitsuchende/Bildungspaket/Leistungen-des-Bildungspakets/leistungen-des-bildungspakets.html',
    fact: 'Children whose parents receive KiZ or Wohngeld generally have access to Bildung und Teilhabe. The 2026 personal school-supplies amount is €195 per calendar year.'
  }
};

export const EVIDENCE_CATALOG = [
  {
    id: 'child_household',
    label: 'Child & household details',
    description: 'Structured household facts used across family-benefit checks.',
    services: ['kiz', 'wohngeld', 'but'],
    source: SOURCES.kiz
  },
  {
    id: 'income_proof',
    label: 'Income evidence',
    description: 'Recent payslips / income evidence for the household.',
    services: ['kiz', 'wohngeld'],
    source: SOURCES.wohngeld
  },
  {
    id: 'housing_proof',
    label: 'Rental / housing-cost evidence',
    description: 'Rental agreement or current housing-cost documentation.',
    services: ['kiz', 'wohngeld'],
    source: SOURCES.wohngeld
  },
  {
    id: 'rent_payment_proof',
    label: 'Recent rent-payment proof',
    description: 'Berlin Wohngeld guidance asks for proof of recent rent payments.',
    services: ['wohngeld'],
    source: SOURCES.wohngeld
  },
  {
    id: 'benefit_notice',
    label: 'KiZ / Wohngeld decision notice',
    description: 'A downstream entitlement signal for Bildung & Teilhabe once KiZ or Wohngeld is actually granted.',
    services: ['but'],
    source: SOURCES.but
  }
];

export const SERVICE_REQUIREMENTS = {
  kiz: ['child_household', 'income_proof', 'housing_proof'],
  wohngeld: ['child_household', 'income_proof', 'housing_proof', 'rent_payment_proof'],
  but: ['child_household', 'benefit_notice']
};

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeHousehold(raw = {}) {
  const children = Array.isArray(raw.children)
    ? raw.children.map((child, index) => ({
        id: child?.id || `child-${index + 1}`,
        age: Math.max(0, Math.round(number(child?.age, 0)))
      }))
    : [];

  const adults = Math.min(2, Math.max(1, Math.round(number(raw.adults, raw.singleParent ? 1 : 2))));
  const singleParent = raw.singleParent === true || adults === 1;

  return {
    adults,
    singleParent,
    children,
    monthlyGrossIncome: Math.max(0, number(raw.monthlyGrossIncome)),
    warmRent: Math.max(0, number(raw.warmRent)),
    receivesKindergeld: raw.receivesKindergeld !== false,
    city: String(raw.city || 'Berlin').slice(0, 120)
  };
}

export function validateHousehold(household) {
  const errors = [];
  if (!household.children.length) errors.push('Add at least one child for this family-benefit demo.');
  if (household.children.some((c) => c.age > 30)) errors.push('Child ages must be realistic.');
  if (household.monthlyGrossIncome > 100000) errors.push('Monthly gross income is outside the supported demo range.');
  if (household.warmRent > 20000) errors.push('Warm rent is outside the supported demo range.');
  return errors;
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 10)}`;
}

function derivePassport(household, benefits) {
  const claims = [
    { id: 'household_type', label: 'Household type', value: household.singleParent ? 'Single parent' : 'Couple', status: 'self_attested' },
    { id: 'children', label: 'Children', value: household.children.map((c) => `${c.age}y`).join(', '), status: 'self_attested' },
    { id: 'income', label: 'Gross household income', value: `€${household.monthlyGrossIncome}/month`, status: 'self_attested' },
    { id: 'rent', label: 'Warm rent', value: `€${household.warmRent}/month`, status: 'self_attested' },
    { id: 'kindergeld_status', label: 'Kindergeld receipt', value: household.receivesKindergeld ? 'Yes' : 'No / unknown', status: 'self_attested' }
  ];

  const evidence = EVIDENCE_CATALOG.map((item) => ({
    ...item,
    status: item.id === 'child_household' ? 'claim_available' : 'not_prepared'
  }));

  const serviceReadiness = Object.entries(SERVICE_REQUIREMENTS).map(([service, required]) => {
    const available = required.filter((id) => evidence.find((e) => e.id === id)?.status === 'claim_available');
    return {
      service,
      required,
      available,
      missing: required.filter((id) => !available.includes(id)),
      claimCoveragePercent: Math.round((available.length / required.length) * 100)
    };
  });

  const downstream = benefits.find((b) => b.id === 'but');

  return {
    passportId: stableId('bp', household),
    version: '0.2',
    createdFrom: 'self_attested_household_snapshot',
    claims,
    evidence,
    serviceReadiness,
    reuseSummary: {
      claimCount: claims.length,
      evidenceCategories: evidence.length,
      multiServiceEvidenceCategories: evidence.filter((e) => e.services.length > 1).length
    },
    downstreamUnlocks: downstream ? [{ id: 'but', status: downstream.status, title: downstream.title }] : [],
    privacy: 'V0.2 stores nothing server-side. The UI can save this passport to this browser only after an explicit human click.'
  };
}

export function planService(result, service) {
  const supported = SERVICE_REQUIREMENTS[service];
  if (!supported) return { ok: false, error: `Unsupported service: ${service}` };
  const evidence = result.passport.evidence;
  const required = supported.map((id) => evidence.find((item) => item.id === id)).filter(Boolean);
  return {
    ok: true,
    traceId: result.traceId,
    passportId: result.passport.passportId,
    service,
    requiredEvidence: required,
    preparedFromClaims: required.filter((item) => item.status === 'claim_available').map((item) => item.id),
    stillNeedsHumanEvidence: required.filter((item) => item.status !== 'claim_available').map((item) => item.id),
    requiresHumanAction: true,
    boundary: 'This is a preparation checklist, not an application or authority decision.'
  };
}

export function evaluateHousehold(raw = {}) {
  const household = normalizeHousehold(raw);
  const errors = validateHousehold(household);
  if (errors.length) {
    return { ok: false, policyVersion: POLICY_VERSION, errors };
  }

  const eligibleKindergeldChildren = household.children.filter((c) => c.age < 18);
  const kindergeldMonthly = household.receivesKindergeld ? eligibleKindergeldChildren.length * 259 : 0;

  const kizChildren = household.children.filter((c) => c.age < 25);
  const kizMinimumIncome = household.singleParent ? 600 : 900;
  const kizPassesIncomeFloor = household.monthlyGrossIncome >= kizMinimumIncome;
  const kizPotential = household.receivesKindergeld && kizChildren.length > 0 && kizPassesIncomeFloor;
  const kizMaxMonthly = kizPotential ? kizChildren.length * 297 : 0;

  const rentShare = household.monthlyGrossIncome > 0
    ? household.warmRent / household.monthlyGrossIncome
    : household.warmRent > 0 ? 1 : 0;
  const wohngeldSignal = household.warmRent > 0 && (rentShare >= 0.25 || household.monthlyGrossIncome <= 3500);
  const butConditional = household.children.length > 0 && (kizPotential || wohngeldSignal);

  const benefits = [
    {
      id: 'kindergeld',
      title: 'Kindergeld',
      status: household.receivesKindergeld && eligibleKindergeldChildren.length ? 'known' : 'check',
      monthlyAmount: kindergeldMonthly,
      amountKind: 'deterministic_anchor',
      confidence: household.receivesKindergeld ? 'high' : 'medium',
      note: household.receivesKindergeld
        ? `${eligibleKindergeldChildren.length} child${eligibleKindergeldChildren.length === 1 ? '' : 'ren'} × €259.`
        : 'Marked as not currently received; verify eligibility with Familienkasse.',
      source: SOURCES.kindergeld
    },
    {
      id: 'kiz',
      title: 'Kinderzuschlag (KiZ)',
      status: kizPotential ? 'potential' : 'unlikely_from_demo_inputs',
      monthlyAmount: kizMaxMonthly,
      amountKind: 'maximum_potential_not_entitlement',
      confidence: 'medium',
      note: kizPotential
        ? `Preliminary gate passed. Up to €${kizMaxMonthly}/month across ${kizChildren.length} child${kizChildren.length === 1 ? '' : 'ren'}; actual KiZ requires the official calculation.`
        : `Preliminary gate not passed in this demo. Minimum gross-income floor used: €${kizMinimumIncome}/month.`,
      source: SOURCES.kiz
    },
    {
      id: 'wohngeld',
      title: 'Wohngeld',
      status: wohngeldSignal ? 'check_officially' : 'not_prioritised',
      monthlyAmount: null,
      amountKind: 'not_calculated',
      confidence: 'low',
      note: wohngeldSignal
        ? 'Worth an official check. This prototype deliberately does not reproduce the statutory Wohngeld formula.'
        : 'Not prioritised by the demo heuristic; an official check can still be appropriate.',
      source: SOURCES.wohngeld
    },
    {
      id: 'but',
      title: 'Bildung & Teilhabe',
      status: butConditional ? 'conditional_unlock' : 'check_if_awarded',
      monthlyAmount: null,
      annualAnchor: 195,
      amountKind: 'conditional_downstream_right',
      confidence: 'high_on_rule_low_on_current_eligibility',
      note: butConditional
        ? 'If KiZ or Wohngeld is actually granted, Bildung & Teilhabe can unlock additional support. 2026 school supplies: €195/year; other components are service-specific.'
        : 'This becomes relevant if the household actually receives KiZ, Wohngeld or another qualifying benefit.',
      source: SOURCES.but
    }
  ];

  const missingEvidence = [
    { id: 'income_proof', label: 'Recent income evidence', reason: 'Reusable across KiZ and Wohngeld preparation.' },
    { id: 'housing_proof', label: 'Rental / housing-cost evidence', reason: 'Reusable across KiZ and Wohngeld preparation.' },
    ...(wohngeldSignal ? [{ id: 'rent_payment_proof', label: 'Recent rent-payment proof', reason: 'Berlin Wohngeld guidance explicitly asks for recent rent-payment evidence.' }] : []),
    ...(butConditional ? [{ id: 'benefit_notice', label: 'Final KiZ / Wohngeld notice', reason: 'Needed before treating Bildung & Teilhabe as an unlocked right.' }] : [])
  ];

  const knownMonthly = benefits
    .filter((b) => b.amountKind === 'deterministic_anchor')
    .reduce((sum, b) => sum + (b.monthlyAmount || 0), 0);

  const potentialAdditionalMax = benefits
    .filter((b) => b.amountKind === 'maximum_potential_not_entitlement')
    .reduce((sum, b) => sum + (b.monthlyAmount || 0), 0);

  const nextSteps = [
    ...(kizPotential ? [{
      priority: 1,
      title: 'Run the official KiZ check',
      why: 'The preliminary family/income gate passed; the exact amount needs the Familienkasse calculation.',
      url: 'https://www.arbeitsagentur.de/familie-und-kinder/kinderzuschlag-verstehen/kiz-lotse'
    }] : []),
    ...(wohngeldSignal ? [{
      priority: 2,
      title: 'Check Wohngeld with the official service',
      why: 'Rent and income suggest it is worth checking; this demo refuses to guess the statutory amount.',
      url: 'https://service.berlin.de/dienstleistung/120656/'
    }] : []),
    {
      priority: 3,
      title: 'Build your Benefit Passport',
      why: 'Income, rent and household facts recur across services. Prepare them once, keep provenance visible, then reuse them.'
    },
    ...(butConditional ? [{
      priority: 4,
      title: 'Re-check downstream rights after an award',
      why: 'A real KiZ or Wohngeld award can unlock Bildung & Teilhabe; do not treat a preliminary signal as the award itself.',
      url: SOURCES.but.url
    }] : [])
  ].sort((a, b) => a.priority - b.priority);

  const trace = [
    { step: 'normalize', outcome: 'Household input normalized.' },
    { step: 'kindergeld_anchor', outcome: `Applied €259 × ${eligibleKindergeldChildren.length} eligible child(ren).` },
    { step: 'kiz_precheck', outcome: `Applied €${kizMinimumIncome} minimum-income gate and €297/child maximum anchor.` },
    { step: 'wohngeld_boundary', outcome: 'Signal only; exact statutory calculation intentionally delegated to official service.' },
    { step: 'downstream_graph', outcome: `Bildung & Teilhabe marked ${butConditional ? 'conditional' : 'not yet unlocked'}; no award was inferred.` },
    { step: 'benefit_passport', outcome: 'Reusable self-attested claims separated from documentary evidence.' },
    { step: 'human_boundary', outcome: 'No application was submitted and no legal entitlement was asserted.' }
  ];

  const baseResult = {
    ok: true,
    traceId: stableId('bb', household),
    policyVersion: POLICY_VERSION,
    generatedAt: new Date().toISOString(),
    household,
    summary: {
      knownMonthly,
      potentialAdditionalMax,
      headline: potentialAdditionalMax
        ? `€${knownMonthly}/month known + up to €${potentialAdditionalMax}/month worth checking`
        : `€${knownMonthly}/month known from the demo inputs`
    },
    benefits,
    missingEvidence,
    nextSteps,
    trace,
    boundary: 'Prototype orientation only. Not a benefits decision, legal advice, or substitute for the responsible authority.'
  };

  return { ...baseResult, passport: derivePassport(household, benefits) };
}
