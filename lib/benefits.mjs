import crypto from 'node:crypto';

export const POLICY_VERSION = 'DE-2026-08-27-passport-v02';
export const MAX_CHILDREN = 20;

export const SOURCES = {
  kindergeld: {
    label: 'Bundesagentur für Arbeit — Kindergeld 2026',
    url: 'https://www.arbeitsagentur.de/news/kindergeld-steigt-2026',
    fact: 'Seit Januar 2026 beträgt das Kindergeld €259 pro anspruchsberechtigtem Kind und Monat.'
  },
  kiz: {
    label: 'Bundesagentur für Arbeit — Kinderzuschlag',
    url: 'https://www.arbeitsagentur.de/familie-und-kinder/kinderzuschlag-verstehen/kiz-lotse',
    fact: 'Der Kinderzuschlag beträgt bis zu €297 pro Kind und Monat. Die tatsächliche Höhe muss offiziell berechnet werden.'
  },
  wohngeld: {
    label: 'Service Berlin — Wohngeld Mietzuschuss',
    url: 'https://service.berlin.de/dienstleistung/120656/',
    fact: 'Für Wohngeld werden unter anderem Einkommens-, Miet- und Mietzahlungsnachweise benötigt. Dieser Pilot berechnet den gesetzlichen Wohngeldbetrag bewusst nicht selbst.'
  },
  but: {
    label: 'BMAS — Bildung und Teilhabe 2026',
    url: 'https://www.bmas.de/DE/Arbeit/Grundsicherung-fuer-Arbeitsuchende/Bildungspaket/Leistungen-des-Bildungspakets/leistungen-des-bildungspakets.html',
    fact: 'Bei bewilligtem KiZ oder Wohngeld können Leistungen für Bildung und Teilhabe hinzukommen. Der Schulbedarf liegt 2026 bei €195 pro Kalenderjahr.'
  }
};

export const EVIDENCE_CATALOG = [
  { id: 'child_household', label: 'Angaben zu Kindern und Haushalt', description: 'Strukturierte Haushaltsangaben, die für mehrere Familienleistungen genutzt werden.', services: ['kiz', 'wohngeld', 'but'], source: SOURCES.kiz },
  { id: 'income_proof', label: 'Einkommensnachweise', description: 'Aktuelle Gehaltsabrechnungen oder andere Einkommensnachweise.', services: ['kiz', 'wohngeld'], source: SOURCES.wohngeld },
  { id: 'housing_proof', label: 'Miet- oder Wohnkostennachweis', description: 'Mietvertrag oder aktuelle Unterlagen zu den Wohnkosten.', services: ['kiz', 'wohngeld'], source: SOURCES.wohngeld },
  { id: 'rent_payment_proof', label: 'Nachweis der letzten Mietzahlungen', description: 'Für Berliner Wohngeld werden Nachweise über aktuelle Mietzahlungen verlangt.', services: ['wohngeld'], source: SOURCES.wohngeld },
  { id: 'benefit_notice', label: 'KiZ- oder Wohngeld-Bescheid', description: 'Erst ein tatsächlicher Bescheid kann nachgelagerte Rechte wie Bildung und Teilhabe belegen.', services: ['but'], source: SOURCES.but }
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
    ? raw.children.slice(0, MAX_CHILDREN + 1).map((child, index) => ({
        id: String(child?.id || `child-${index + 1}`).slice(0, 64),
        age: Math.max(0, Math.round(number(child?.age, 0)))
      }))
    : [];

  const adults = Math.min(2, Math.max(1, Math.round(number(raw.adults, raw.singleParent ? 1 : 2))));
  const singleParent = adults === 1;

  return {
    adults,
    singleParent,
    children,
    monthlyGrossIncome: Math.max(0, number(raw.monthlyGrossIncome)),
    warmRent: Math.max(0, number(raw.warmRent)),
    receivesKindergeld: raw.receivesKindergeld === true,
    city: String(raw.city || 'Berlin').trim().slice(0, 120)
  };
}

export function validateHousehold(household) {
  const errors = [];
  if (!household.children.length) errors.push('Bitte mindestens ein Kind angeben.');
  if (household.children.length > MAX_CHILDREN) errors.push(`Dieser Pilot unterstützt maximal ${MAX_CHILDREN} Kinder pro Haushalt.`);
  if (household.children.some((child) => child.age > 30)) errors.push('Das angegebene Kindesalter liegt außerhalb des unterstützten Bereichs.');
  if (household.monthlyGrossIncome > 100000) errors.push('Das monatliche Bruttoeinkommen liegt außerhalb des unterstützten Bereichs.');
  if (household.warmRent > 20000) errors.push('Die Warmmiete liegt außerhalb des unterstützten Bereichs.');
  if (household.city.toLowerCase() !== 'berlin') errors.push('Dieser Pilot unterstützt aktuell nur Berlin.');
  return errors;
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 10)}`;
}

function derivePassport(household, benefits) {
  const claims = [
    { id: 'household_type', label: 'Haushalt', value: household.singleParent ? 'Alleinerziehend' : 'Zwei Erwachsene', status: 'self_attested' },
    { id: 'children', label: 'Kinder', value: household.children.map((child) => `${child.age} Jahre`).join(', '), status: 'self_attested' },
    { id: 'income', label: 'Bruttoeinkommen', value: `€${household.monthlyGrossIncome}/Monat`, status: 'self_attested' },
    { id: 'rent', label: 'Warmmiete', value: `€${household.warmRent}/Monat`, status: 'self_attested' },
    { id: 'kindergeld_status', label: 'Kindergeld', value: household.receivesKindergeld ? 'Ja' : 'Nein / unbekannt', status: 'self_attested' }
  ];

  const evidence = EVIDENCE_CATALOG.map((item) => ({ ...item, status: item.id === 'child_household' ? 'claim_available' : 'not_prepared' }));
  const serviceReadiness = Object.entries(SERVICE_REQUIREMENTS).map(([service, required]) => {
    const available = required.filter((id) => evidence.find((entry) => entry.id === id)?.status === 'claim_available');
    return { service, required, available, missing: required.filter((id) => !available.includes(id)), claimCoveragePercent: Math.round((available.length / required.length) * 100) };
  });
  const downstream = benefits.find((benefit) => benefit.id === 'but');

  return {
    passportId: stableId('bp', household), version: '0.2', createdFrom: 'self_attested_household_snapshot', claims, evidence, serviceReadiness,
    reuseSummary: { claimCount: claims.length, evidenceCategories: evidence.length, multiServiceEvidenceCategories: evidence.filter((entry) => entry.services.length > 1).length },
    downstreamUnlocks: downstream ? [{ id: 'but', status: downstream.status, title: downstream.title }] : [],
    privacy: 'Serverseitig wird in diesem Pilot nichts gespeichert. Eine lokale Browser-Kopie entsteht nur nach einem ausdrücklichen Klick.'
  };
}

export function planService(result, service) {
  const supported = SERVICE_REQUIREMENTS[service];
  if (!supported) return { ok: false, error: `Unsupported service: ${service}` };
  const evidence = result.passport.evidence;
  const required = supported.map((id) => evidence.find((entry) => entry.id === id)).filter(Boolean);
  return {
    ok: true, traceId: result.traceId, passportId: result.passport.passportId, service, requiredEvidence: required,
    preparedFromClaims: required.filter((entry) => entry.status === 'claim_available').map((entry) => entry.id),
    stillNeedsHumanEvidence: required.filter((entry) => entry.status !== 'claim_available').map((entry) => entry.id),
    requiresHumanAction: true,
    boundary: 'Vorbereitungsliste, kein Antrag und keine Behördenentscheidung.'
  };
}

export function evaluateHousehold(raw = {}) {
  const household = normalizeHousehold(raw);
  const errors = validateHousehold(household);
  if (errors.length) return { ok: false, policyVersion: POLICY_VERSION, errors };

  const eligibleKindergeldChildren = household.children.filter((child) => child.age < 18);
  const kindergeldMonthly = household.receivesKindergeld ? eligibleKindergeldChildren.length * 259 : 0;

  const kizChildren = household.children.filter((child) => child.age < 25);
  const kizMinimumIncome = household.singleParent ? 600 : 900;
  const kizPassesIncomeFloor = household.monthlyGrossIncome >= kizMinimumIncome;
  const kizPotential = household.receivesKindergeld && kizChildren.length > 0 && kizPassesIncomeFloor;
  const kizMaxMonthly = kizPotential ? kizChildren.length * 297 : 0;

  const rentShare = household.monthlyGrossIncome > 0 ? household.warmRent / household.monthlyGrossIncome : household.warmRent > 0 ? 1 : 0;
  const wohngeldSignal = household.warmRent > 0 && (rentShare >= 0.25 || household.monthlyGrossIncome <= 3500);
  const butConditional = household.children.length > 0 && (kizPotential || wohngeldSignal);

  const benefits = [
    {
      id: 'kindergeld', title: 'Kindergeld', status: household.receivesKindergeld && eligibleKindergeldChildren.length ? 'known' : 'check',
      monthlyAmount: kindergeldMonthly, amountKind: 'deterministic_anchor', confidence: household.receivesKindergeld ? 'high' : 'medium',
      note: household.receivesKindergeld
        ? `${eligibleKindergeldChildren.length} ${eligibleKindergeldChildren.length === 1 ? 'Kind' : 'Kinder'} unter 18 × €259.`
        : 'Aktuell nicht als erhalten markiert. Bitte einen möglichen Anspruch bei der Familienkasse prüfen.', source: SOURCES.kindergeld
    },
    {
      id: 'kiz', title: 'Kinderzuschlag (KiZ)', status: kizPotential ? 'potential' : 'unlikely_from_demo_inputs', monthlyAmount: kizMaxMonthly,
      amountKind: 'maximum_potential_not_entitlement', confidence: 'medium',
      note: kizPotential
        ? `Die erste Prüfschwelle ist erfüllt. Bis zu €${kizMaxMonthly}/Monat für ${kizChildren.length} ${kizChildren.length === 1 ? 'Kind' : 'Kinder'} sind möglich; die tatsächliche Höhe berechnet die Familienkasse.`
        : `Die erste Prüfschwelle ist in diesem Pilot nicht erfüllt. Verwendete Mindesteinkommensgrenze: €${kizMinimumIncome}/Monat.`, source: SOURCES.kiz
    },
    {
      id: 'wohngeld', title: 'Wohngeld', status: wohngeldSignal ? 'check_officially' : 'not_prioritised', monthlyAmount: null,
      amountKind: 'not_calculated', confidence: 'low',
      note: wohngeldSignal
        ? 'Eine offizielle Prüfung lohnt sich. Dieser Pilot erfindet bewusst keinen Wohngeldbetrag.'
        : 'Nach dieser einfachen Vorprüfung nicht priorisiert. Eine offizielle Prüfung kann trotzdem sinnvoll sein.', source: SOURCES.wohngeld
    },
    {
      id: 'but', title: 'Bildung & Teilhabe', status: butConditional ? 'conditional_unlock' : 'check_if_awarded', monthlyAmount: null, annualAnchor: 195,
      amountKind: 'conditional_downstream_right', confidence: 'high_on_rule_low_on_current_eligibility',
      note: butConditional
        ? 'Wenn KiZ oder Wohngeld tatsächlich bewilligt wird, können weitere Leistungen für Bildung und Teilhabe hinzukommen. Schulbedarf 2026: €195/Jahr.'
        : 'Wird relevant, sobald KiZ, Wohngeld oder eine andere qualifizierende Leistung tatsächlich bewilligt ist.', source: SOURCES.but
    }
  ];

  const missingEvidence = [
    { id: 'income_proof', label: 'Aktuelle Einkommensnachweise', reason: 'Können für KiZ und Wohngeld wiederverwendet werden.' },
    { id: 'housing_proof', label: 'Miet- oder Wohnkostennachweis', reason: 'Kann für KiZ und Wohngeld wiederverwendet werden.' },
    ...(wohngeldSignal ? [{ id: 'rent_payment_proof', label: 'Nachweise der letzten Mietzahlungen', reason: 'Für Berliner Wohngeld werden aktuelle Mietzahlungsnachweise verlangt.' }] : []),
    ...(butConditional ? [{ id: 'benefit_notice', label: 'Endgültiger KiZ- oder Wohngeld-Bescheid', reason: 'Erst damit darf Bildung und Teilhabe als tatsächlich freigeschaltet behandelt werden.' }] : [])
  ];

  const knownMonthly = benefits.filter((benefit) => benefit.amountKind === 'deterministic_anchor').reduce((sum, benefit) => sum + (benefit.monthlyAmount || 0), 0);
  const potentialAdditionalMax = benefits.filter((benefit) => benefit.amountKind === 'maximum_potential_not_entitlement').reduce((sum, benefit) => sum + (benefit.monthlyAmount || 0), 0);

  const nextSteps = [
    ...(kizPotential ? [{ priority: 1, title: 'Kinderzuschlag offiziell prüfen', why: 'Die erste Familien- und Einkommensprüfung ist positiv. Die genaue Höhe muss die Familienkasse berechnen.', url: SOURCES.kiz.url }] : []),
    ...(wohngeldSignal ? [{ priority: 2, title: 'Wohngeld offiziell prüfen', why: 'Miete und Einkommen sprechen dafür, genauer hinzusehen. Dieser Pilot berechnet bewusst keinen gesetzlichen Betrag.', url: SOURCES.wohngeld.url }] : []),
    { priority: 3, title: 'Unterlagen einmal vorbereiten', why: 'Einkommen, Miete und Haushaltsangaben werden für mehrere Leistungen gebraucht. Bereiten Sie sie einmal vor und behalten Sie die Herkunft sichtbar.' },
    ...(butConditional ? [{ priority: 4, title: 'Nach einer Bewilligung weitere Rechte prüfen', why: 'Ein echter KiZ- oder Wohngeld-Bescheid kann Bildung und Teilhabe freischalten. Ein Vorabhinweis ist noch kein Bescheid.', url: SOURCES.but.url }] : [])
  ].sort((a, b) => a.priority - b.priority);

  const trace = [
    { step: 'Eingaben normalisieren', outcome: 'Haushaltsangaben wurden in ein einheitliches Format gebracht.' },
    { step: 'Kindergeld-Richtwert', outcome: `€259 × ${eligibleKindergeldChildren.length} berücksichtigte Kinder unter 18.` },
    { step: 'KiZ-Vorprüfung', outcome: `Mindesteinkommensgrenze €${kizMinimumIncome} und Höchstwert €297 pro Kind angewendet.` },
    { step: 'Wohngeld-Grenze', outcome: 'Nur Prüfhinweis; die gesetzliche Berechnung bleibt beim offiziellen Dienst.' },
    { step: 'Nachgelagerte Rechte', outcome: `Bildung & Teilhabe ist ${butConditional ? 'bedingt relevant' : 'noch nicht freigeschaltet'}; es wurde keine Bewilligung erfunden.` },
    { step: 'Public Service Passport', outcome: 'Eigene Angaben bleiben von Dokumenten getrennt.' },
    { step: 'Menschliche Entscheidung', outcome: 'Es wurde kein Antrag eingereicht und kein Rechtsanspruch behauptet.' }
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
        ? `€${knownMonthly}/Monat bekannt + bis zu €${potentialAdditionalMax}/Monat zusätzlich prüfen`
        : `€${knownMonthly}/Monat aus Ihren Angaben sicher zuordenbar`
    },
    benefits,
    missingEvidence,
    nextSteps,
    trace,
    boundary: 'Orientierung, keine Behördenentscheidung und keine Rechtsberatung.'
  };

  return { ...baseResult, passport: derivePassport(household, benefits) };
}
