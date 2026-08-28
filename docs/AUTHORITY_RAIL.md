# Public Service Passport × OpenAction/OpenProof — Authority Rail

Status: implementation blueprint for a sandbox/pilot integration. It does **not** enable live authority submission from the current challenge UI.

## Goal

Close the loop from:

`citizen/agent → verified facts → authority-ready application → authority review → decision → payment → reconciliation`

without turning an AI agent into a public authority and without pretending that self-attested data is already verified.

## Product split

- **Public Service Passport** — citizen and agent front door: collect facts, explain possible benefits, reuse evidence with permission, prepare the application.
- **OpenProof claim layer** — attach provenance and verification state to every consequential fact.
- **OpenAction** — shared case state, approval gates, evidence references, authority receipts, change impact and financial state.
- **Official transport** — use the authority's supported channel. Where available, a FIT-Connect adapter can send structured data, metadata and attachments to the competent receiving system.
- **Authoritative Fachverfahren / finance system** — remains the system that legally decides and pays.

## Verification ladder

Do not use a single `confirmed: true` flag. Every claim has an explicit verification tier:

1. `self_attested` — entered by the citizen or their agent.
2. `document_backed` — supported by a supplied document, but not yet confirmed by an authoritative source.
3. `source_verified` — retrieved or validated against an authoritative source/register with scope, issuer and validity.
4. `authority_verified` — accepted by the competent authority for this case/scope, normally backed by an authoritative receipt.

Every proof should carry, where applicable:

- issuer / source system
- stable evidence or register reference
- scope and purpose
- retrieved / issued / verified timestamp
- validity / expiry
- integrity hash or signature
- consent / legal basis reference
- supersedes relationship

Unknown stays unknown. `prepared_by_human` is never upgraded to `source_verified` without a real proof event.

## End-to-end state machine

```text
DRAFT
  ↓ citizen/agent completes facts
PREPARED
  ↓ preflight: schema, completeness, contradictions, evidence map
READY_FOR_USER_AUTHORISATION
  ↓ explicit user consent / authentication
AUTHORISED_FOR_SUBMISSION
  ↓ official adapter (e.g. FIT-Connect / authority eService)
SUBMITTED
  ↓ transport receipt
RECEIVED_BY_AUTHORITY
  ↓ authority-side schema + proof verification
PREFLIGHTED
  ├─ exceptions → IN_REVIEW
  └─ no exceptions → READY_FOR_DECISION
  ↓ competent authority
DECIDED_APPROVED | DECIDED_REJECTED
  ↓ if approved
PAYMENT_INSTRUCTED
  ↓ authoritative finance/payment system
PAYMENT_SENT
  ↓ settlement confirmation
PAID
  ↓ accounting / case reconciliation
RECONCILED
```

The challenge build intentionally stops before `AUTHORISED_FOR_SUBMISSION`. A production authority adapter is a separate permissioned component.

## Authority-ready case bundle

A submission bundle should contain:

- service + destination identifiers
- applicant identity reference and authentication level
- structured Fachdatensatz matching the authority schema
- claims with verification tier and provenance
- evidence manifest with hashes / signatures / authoritative references
- deterministic calculation trace and policy version
- unresolved contradictions or missing facts
- consent scopes and purpose limitation
- idempotency / correlation ID
- user review receipt
- attachments only where the receiving authority actually needs them

The authority should not have to reverse-engineer a PDF when the same information can arrive as validated structured data.

## How the authority gets the information

Preferred order:

1. **Existing official eService integration** when the authority exposes an accepted interface.
2. **FIT-Connect adapter** where a compatible destination and Fachdatenschema exist.
3. **Portal handoff** only when no machine interface exists: pre-fill or export into the official service, preserving user control.

A successful transport is not an approval. Store a transport receipt separately from the later authority decision receipt.

## Authority Workbench

Public Service Passport should have a separate authority-facing projection backed by OpenAction rather than giving officials the citizen UI.

### Automatic preflight

- validate Fachdatenschema
- verify evidence hashes / signatures
- resolve authoritative-source references
- verify identity/authentication level
- detect duplicate / overlapping applications
- recalculate deterministic rules independently
- detect contradictions and expired evidence
- identify which required facts are already source-verified
- flag only exceptions that require a person

### Human review

The reviewer sees:

- what is already verified and by whom
- what is merely self-attested
- what changed since a prior verified case
- exact unresolved questions
- legal/rule basis and calculation trace
- evidence needed for each unresolved gate
- a draft decision, never an invisible autonomous approval

OpenAction's completion contract applies: `submitted` is not complete; a consequential gate is green only after valid verification/authority receipt.

## Fast path vs exception path

### Fast path

A low-complexity case can move quickly when:

- identity is sufficient for the service
- required facts are source-verified or accepted by authority policy
- no conflicting evidence exists
- all mandatory fields are complete
- deterministic authority-side recomputation agrees
- no discretionary/legal balancing is required

If law and authority policy permit automation, the authority can decide how much of this path may be straight-through. Public Service Passport itself does not grant that authority.

### Exception path

Humans receive only the unresolved questions, e.g.:

- income source cannot be verified
- rent evidence conflicts with entered amount
- household composition changed
- prior benefit overlaps
- evidence expired
- discretionary judgment required

This is where the time saving comes from: **review the exceptions, not re-key and re-check every field of every clean case.**

## OpenAction/OpenProof mapping

- Citizen claim / evidence → OpenAction `evidence[]` plus OpenProof verification metadata.
- Preparing/submitting the application → OpenAction Action Core with permissions, risk, evidence and idempotency key.
- Benefit-specific review steps → OpenAction Approval Path gates.
- Authority decision → OpenAction Approval Receipt with approver identity, scope, evidence snapshot and conditions.
- Relevant changed fact → OpenAction Change Impact; reopen only affected gates.
- Money → OpenAction financial trail, but references the authority's authoritative payment/accounting system rather than replacing it.

The existing OpenAction Trust Passport is useful for reusable organisational/product approval evidence. Citizen benefit facts need a smaller claim-level proof object; do not force personal claims into the product-oriented Trust Passport schema.

## Decision and payment

After approval, the competent authority should create a payment instruction in its existing Fach-/finance system. Public Service Passport should receive only the minimum status/receipt needed for the citizen timeline.

Recommended financial states:

`decision_approved → payment_instructed → payment_authorized → payment_sent → settled → reconciled`

Keep these distinct. `decision_approved` does not mean money has arrived; `payment_sent` does not prove settlement.

A minimal payment receipt can expose:

- case/correlation ID
- amount and period
- instruction date
- value/settlement date when known
- status
- authoritative payment reference

Bank details remain restricted and need not be copied into OpenAction.

## Citizen timeline

The citizen should see one simple timeline:

```text
✓ Angaben vollständig
✓ Nachweise geprüft
✓ Antrag übermittelt
✓ Behörde hat Antrag erhalten
● Behörde prüft 1 offenen Punkt
○ Entscheidung
○ Auszahlung
```

When approved:

```text
✓ Bewilligt: €X / Monat
✓ Auszahlung angewiesen
✓ Geld ausgezahlt am DD.MM.YYYY
```

Every line should be backed by a real event/receipt, not optimistic UI state.

## How this reduces authority workload

Measure these explicitly:

- first-time-right completeness rate
- percentage of required facts source-verified on arrival
- evidence reuse rate
- manual data-entry touches per case
- requests for missing documents per case
- exception rate
- median receipt → decision time
- median decision → payment-instruction time
- duplicate/rework rate
- reconciliation/error rate

The primary objective is not “AI processed the case”. It is **fewer avoidable human touches and less waiting while preserving accountable decisions**.

## Pilot we can run before any authority integration

1. Create 50–100 synthetic KiZ/Wohngeld cases.
2. Generate mixed verification tiers: clean, missing, conflicting, expired and changed evidence.
3. Convert each Public Service Passport packet into an Authority-Ready Case Bundle.
4. Run an Authority Workbench simulator that independently validates and recomputes each case.
5. Produce an OpenAction approval path and synthetic decision receipt.
6. Simulate payment instruction → settled → reconciled events.
7. Measure manual-review rate, exception reasons and time saved versus a baseline where every case is manually re-entered/rechecked.

No synthetic authority decision or payment is presented as a real government action.

## Production integration boundary

A real pilot needs the receiving authority/IT provider to supply or approve:

- accepted Fachdatenschema / process standard
- destination / transport interface
- required authentication level
- authoritative evidence sources it accepts
- decision policy and automation limits
- status / receipt callback mechanism
- payment-system integration contract
- data protection, retention and audit requirements

Until then, Public Service Passport may prepare, prove and simulate — but does not claim to submit or pay.