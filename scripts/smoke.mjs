import { evaluateHousehold } from '../lib/benefits.mjs';
import { prepareLocalApplicationPacket, validateLocalApplicationPacket } from '../public/packet-core.js';

const result = evaluateHousehold({ adults: 1, singleParent: true, children: [{ age: 7 }, { age: 12 }], monthlyGrossIncome: 2000, warmRent: 1100, receivesKindergeld: true, city: 'Berlin' });
if (!result.ok) throw new Error('Smoke household failed');
if (result.summary.knownMonthly !== 518) throw new Error(`Expected €518 known, got ${result.summary.knownMonthly}`);
if (result.summary.potentialAdditionalMax !== 594) throw new Error(`Expected €594 KiZ max, got ${result.summary.potentialAdditionalMax}`);
const packet = prepareLocalApplicationPacket(result, 'kiz', { applicationDetails: { applicant_name: 'Mara Beispiel', applicant_address: 'Sonnenallee 100, 12045 Berlin', applicant_email: 'mara@example.invalid', basic_security_status: 'No (self-attested)' }, preparedEvidence: ['income_proof', 'housing_proof'] });
if (packet.status !== 'ready_for_human_review') throw new Error('Packet not ready for review');
const validation = validateLocalApplicationPacket(packet, { claims_reviewed: true, evidence_status_reviewed: true, not_submission_understood: true });
if (!validation.readyForOfficialServiceHandoff) throw new Error('Packet not handoff-ready');
if (validation.submissionAllowed) throw new Error('Submission boundary violated');
console.log(JSON.stringify({ ok: true, headline: result.summary.headline, traceId: result.traceId, packetId: packet.packetId, packetStatus: packet.status, submissionAllowed: false }, null, 2));
