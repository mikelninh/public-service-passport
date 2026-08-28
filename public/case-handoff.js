export const CITIZEN_AUTHORITY_HANDOFF_SCHEMA = 'psp.citizen-authority-handoff/1';
export const CITIZEN_AUTHORITY_HANDOFF_STORAGE_KEY = 'psp-v1-authority-handoff';
export const CITIZEN_AUTHORITY_HANDOFF_TTL_MS = 15 * 60 * 1000;

function finiteNumber(value, label, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) throw new Error(`${label} invalid`);
  return number;
}

function normalizeHousehold(input = {}) {
  const adults = Number(input.adults);
  if (![1, 2].includes(adults)) throw new Error('adults invalid');
  const children = Array.isArray(input.children) ? input.children : [];
  if (children.length < 1 || children.length > 12) throw new Error('children invalid');
  const ages = children.map((child) => finiteNumber(child?.age, 'child age', 0, 30));
  const city = String(input.city || '').trim();
  if (city.toLowerCase() !== 'berlin') throw new Error('unsupported city');
  return {
    adults,
    singleParent: adults === 1,
    children: ages.map((age) => ({ age })),
    monthlyGrossIncome: finiteNumber(input.monthlyGrossIncome, 'income', 0, 100000),
    warmRent: finiteNumber(input.warmRent, 'rent', 0, 20000),
    receivesKindergeld: input.receivesKindergeld === true,
    city: 'Berlin'
  };
}

function claim(id, value) {
  return { id, value, verificationTier: 'self_attested', source: 'lokaler Bürger-Handoff' };
}

export function createCitizenAuthorityHandoff({ household, policyVersion = 'unknown', handoffId = 'local-preview', now = Date.now() } = {}) {
  const normalized = normalizeHousehold(household);
  const createdAt = Number(now);
  if (!Number.isFinite(createdAt) || createdAt < 0) throw new Error('now invalid');
  return {
    schema: CITIZEN_AUTHORITY_HANDOFF_SCHEMA,
    handoffId: String(handoffId).slice(0, 120),
    createdAt,
    expiresAt: createdAt + CITIZEN_AUTHORITY_HANDOFF_TTL_MS,
    source: 'public-service-passport-v1',
    transport: { mode: 'local-browser-preview', submittedToAuthority: false, oneTime: true },
    policyVersion: String(policyVersion || 'unknown').slice(0, 160),
    jurisdiction: 'DE-BE',
    service: 'kiz-precheck',
    household: normalized,
    claims: [
      claim('children', `${normalized.children.length} Kind${normalized.children.length === 1 ? '' : 'er'} · ${normalized.children.map((child) => child.age).join(', ')} Jahre`),
      claim('income', normalized.monthlyGrossIncome),
      claim('rent', normalized.warmRent),
      claim('kindergeld_status', normalized.receivesKindergeld)
    ],
    proof: {
      state: 'self_attested',
      authoritativeReceiptAttached: false,
      boundary: 'No citizen-entered value is upgraded by this handoff.'
    }
  };
}

export function parseCitizenAuthorityHandoff(raw, { now = Date.now() } = {}) {
  let value;
  try { value = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { throw new Error('handoff JSON invalid'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('handoff missing');
  if (value.schema !== CITIZEN_AUTHORITY_HANDOFF_SCHEMA) throw new Error('handoff schema mismatch');
  if (value.source !== 'public-service-passport-v1') throw new Error('handoff source mismatch');
  if (value.transport?.mode !== 'local-browser-preview' || value.transport?.submittedToAuthority !== false || value.transport?.oneTime !== true) {
    throw new Error('handoff transport boundary invalid');
  }
  const current = Number(now);
  if (!Number.isFinite(value.createdAt) || !Number.isFinite(value.expiresAt) || value.expiresAt <= value.createdAt) throw new Error('handoff time invalid');
  if (current > value.expiresAt) throw new Error('handoff expired');
  if (value.expiresAt - value.createdAt > CITIZEN_AUTHORITY_HANDOFF_TTL_MS) throw new Error('handoff TTL invalid');
  const household = normalizeHousehold(value.household);
  if (!Array.isArray(value.claims) || value.claims.length !== 4) throw new Error('handoff claims invalid');
  for (const item of value.claims) {
    if (item?.verificationTier !== 'self_attested') throw new Error('handoff cannot upgrade verification tier');
    if (item?.source !== 'lokaler Bürger-Handoff') throw new Error('handoff claim source invalid');
  }
  if (value.proof?.authoritativeReceiptAttached !== false || value.proof?.state !== 'self_attested') {
    throw new Error('handoff cannot attach authoritative proof');
  }
  return { ...value, household };
}
