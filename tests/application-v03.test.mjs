import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateHousehold } from '../lib/benefits.mjs';
import { prepareLocalApplicationPacket, validateLocalApplicationPacket, packetSchemas } from '../public/packet-core.js';

const result = evaluateHousehold({ adults: 1, children: [{ age: 7 }, { age: 12 }], monthlyGrossIncome: 2000, warmRent: 1100, receivesKindergeld: true });
const details = { applicant_name: 'Mara Beispiel', applicant_address: 'Sonnenallee 100, 12045 Berlin', applicant_email: 'mara@example.invalid', basic_security_status: 'No (self-attested)', residency_basis: 'German / EU status to be confirmed by applicant' };

test('v0.3 packet core supports KiZ, Wohngeld and BuT schemas', () => { assert.deepEqual(Object.keys(packetSchemas()), ['kiz','wohngeld','but']); });
test('KiZ packet keeps claim provenance visible', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details,preparedEvidence:['income_proof','housing_proof']}); assert.equal(p.fields.find(f=>f.id==='income').provenance.type,'self_attested_claim'); });
test('local applicant identity is labelled local human input', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details}); assert.equal(p.fields.find(f=>f.id==='applicant_name').provenance.type,'local_human_input'); assert.ok(p.privacy.includes('browser-locally')); });
test('missing evidence blocks packet rather than faking completion', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details}); assert.equal(p.status,'draft_blocked'); assert.ok(p.missingEvidence.includes('income_proof')); });
test('complete KiZ prep reaches human review', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details,preparedEvidence:['income_proof','housing_proof']}); assert.equal(p.status,'ready_for_human_review'); });
test('Wohngeld packet requires identity and rent-payment evidence', () => { const p=prepareLocalApplicationPacket(result,'wohngeld',{applicationDetails:details}); assert.ok(p.missingEvidence.includes('identity_documents')); assert.ok(p.missingEvidence.includes('rent_payment_proof')); });
test('approval requires three explicit confirmations', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details,preparedEvidence:['income_proof','housing_proof']}); const v=validateLocalApplicationPacket(p,{}); assert.equal(v.missingConfirmations.length,3); assert.equal(v.canApproveDraftForExport,false); });
test('human-reviewed complete packet can hand off but never submit', () => { const p=prepareLocalApplicationPacket(result,'kiz',{applicationDetails:details,preparedEvidence:['income_proof','housing_proof']}); const v=validateLocalApplicationPacket(p,{claims_reviewed:true,evidence_status_reviewed:true,not_submission_understood:true}); assert.equal(v.readyForOfficialServiceHandoff,true); assert.equal(v.submissionAllowed,false); });
