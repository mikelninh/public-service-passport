# Public Service Passport 🇩🇪

**Tell public services once. Reuse it safely.**

A working Berlin pilot that helps families understand possible public benefits, see what is known vs. uncertain, prepare the right evidence, and create a reviewable application draft — while keeping the final decision with the person and the authority.

👉 **Citizen demo:** https://public-service-passport.netlify.app/

👉 **Authority sandbox:** https://public-service-passport.netlify.app/authority.html

👉 **100-case authority pilot:** https://public-service-passport.netlify.app/pilot.html

The Authority Workbench and 100-case pilot are explicitly synthetic proofs. They demonstrate verified facts → authority preflight → exception handling → decision → payment instruction → settlement → reconciliation, but do not connect to a real authority or bank.

## Why this exists

Public services repeatedly ask people for the same facts: household, children, income, rent, evidence. Citizens then have to work out which benefit might apply, which document is needed where, and what is actually certain.

Public Service Passport explores a simpler model:

> **enter facts once → preserve provenance → reuse with permission → prepare safely → human approval → authority decision → payment receipt**

The first working module is **Benefit Bridge**, focused on family benefits in Berlin.

## What a citizen can do today

1. Enter household, income, rent and children.
2. See clearly separated results:
   - known amounts,
   - benefits worth checking,
   - questions that only the authority can decide.
3. See which evidence is likely needed.
4. Build a reusable local Benefit Passport.
5. Prepare a reviewable application packet.
6. Approve a **local export only**.

Nothing is submitted to an authority.

## Example

Synthetic Berlin household:

- single parent
- children aged 7 and 12
- €2,000 gross income / month
- €1,100 warm rent
- currently receives Kindergeld

Current result:

- **€518/month known Kindergeld anchor** — 2 × €259
- **up to €594/month Kinderzuschlag worth checking** — maximum anchor, not entitlement
- **Wohngeld → official check** — no invented amount
- **Bildung & Teilhabe → conditional downstream right** if a qualifying benefit is awarded

## WebMCP: a safe interface for AI agents

The website works normally for people. WebMCP adds a structured interface so a compatible AI assistant can understand exactly what the site allows it to do.

A person could simply ask:

> “Check which family benefits might apply to me, tell me which documents are missing, and prepare the next step.”

Instead of guessing which buttons to click, the agent receives explicit tools with typed inputs and outputs.

**Current surface: 11 read-only tools · 0 submission tools.**

Examples:

- `check_eligibility`
- `calculate_support`
- `list_missing_evidence`
- `derive_benefit_passport`
- `plan_application`
- `prepare_application_packet`
- `validate_application_packet`

There is deliberately **no** `submit_application`, signing, authentication-as-user, or upload-to-authority tool.

> **Agents prepare. People authorise. Authorities decide.**

## Trust model

Every result follows the same chain:

**claim → evidence → derived signal → prepared application field → human review → authority decision → payment receipt**

Key rules:

- self-entered facts stay labelled as self-attested
- prepared evidence is never called authority-verified
- source verification and authority verification are separate trust levels
- missing information stays missing
- unsupported geography fails closed instead of reusing Berlin rules
- browser-local applicant identity/contact data does not need to be sent to `/api/evaluate`
- packet approval never changes `submissionAllowed: false`
- the server is stateless
- payment cannot start before an approved authority decision in the sandbox state machine
- `payment_sent` is not the same as `settled`

## End-to-end authority proof

The separate **Authority Workbench** demonstrates four deterministic synthetic cases:

1. **Clean fast path** — all required claims are source-verified and the case becomes decision-ready without exception review.
2. **Missing income proof** — the case stops until income is source-verified.
3. **Rent conflict** — the case stops when the entered rent and evidence disagree.
4. **Expired identity proof** — the case stops until a valid proof replaces the expired one.

For approved cases the sandbox keeps these states distinct:

```text
received_by_authority
→ preflighted / in_review
→ ready_for_decision
→ decision_approved
→ payment_instructed
→ payment_sent
→ paid (settled)
→ reconciled
```

Each important transition creates an inspectable synthetic event/receipt. The full architecture is documented in [`docs/AUTHORITY_RAIL.md`](docs/AUTHORITY_RAIL.md) and the machine-readable handoff contract is in [`schemas/authority-case-bundle.schema.json`](schemas/authority-case-bundle.schema.json).

## 100-case authority pilot

The controlled pilot runs **100 deterministic synthetic cases** through the same authority state machine. Every case has a route and exact exception-code ground truth defined before execution.

Current CI result:

- **100 cases**
- **40 initial Fast Path / 60 Exception Path**
- **100% route accuracy** against the controlled ground truth
- **100% exception-code accuracy**
- **87% average source-verified claim coverage on arrival** by cohort design
- **93 synthetic approvals / 7 synthetic rejections**
- **93/93 approvals settled and reconciled**
- **7/7 rejected payment attempts blocked**

The pilot also exposes an illustrative workload model: 500 baseline manual touches vs. 160 modeled touches, or **68% fewer**. This is **not measured authority impact**; it is the output of an explicit assumption model for this synthetic cohort. See [`docs/AUTHORITY_PILOT_100.md`](docs/AUTHORITY_PILOT_100.md).

Reproduce it with:

```bash
npm run pilot
npm run pilot -- --json
```

## Proof, not just claims

The current release has been tested at multiple layers:

- **64/64 deterministic, integration, adversarial, authority-flow and 100-case-pilot tests passing**
- happy-path household → benefits → passport → application packet → human review
- KiZ, Wohngeld and Bildung & Teilhabe preparation flows
- malformed JSON and wrong HTTP methods/content types
- unsupported city rejection
- contradictory household inputs
- omitted Kindergeld status fails closed
- oversized requests and household-size limits
- XSS/malicious text handling
- strict CSP, frame protection and `nosniff`
- zero-submit authority-boundary guard
- authority decision/payment transition guards
- clean fast path + missing/conflicting/expired proof exception paths
- 100-case controlled ground-truth routing and payout-integrity run in CI
- responsive desktop + 390 px mobile browser QA
- native Chrome WebMCP discovery: **11/11 tools, all read-only**
- external production browser run against the public Netlify deployment

The production browser test clicked the real **Unterstützung prüfen** CTA and verified the expected Berlin demo result, Passport visibility and Application Studio visibility with zero product runtime errors.

## Scope

This is a **working Berlin public-benefits pilot**, not a complete German entitlement engine or a live authority integration.

Currently implemented:

```text
Public Service Passport
└─ Benefits / Benefit Bridge      ← LIVE · Berlin pilot
   ├─ Kindergeld orientation
   ├─ Kinderzuschlag signal
   ├─ Wohngeld official-check routing
   ├─ Bildung & Teilhabe downstream signal
   ├─ reusable evidence passport
   └─ application preparation

Synthetic authority proof
├─ Authority Workbench
│  ├─ claim verification tiers
│  ├─ automatic preflight
│  ├─ exception routing
│  ├─ decision receipt
│  └─ payment / settlement / reconciliation states
└─ Authority Pilot 100
   ├─ controlled ground-truth cohort
   ├─ exception-code evaluation
   ├─ payment integrity evaluation
   └─ transparent workload model

Future production directions
├─ official identity / register proofs
├─ authority-approved Fachdatenschema
├─ official submission transport such as FIT-Connect where supported
├─ authority status/receipt callbacks
├─ Fachverfahren integration
└─ finance/payment-system integration
```

Final entitlement, all binding decisions and real payments remain with the responsible authority and its authoritative systems.

## Run locally

```bash
npm run dev
# http://localhost:8888
# http://localhost:8888/authority.html
# http://localhost:8888/pilot.html
```

## Verify

```bash
npm run check
npm run pilot
node --check public/app.js
node --check public/packet-core.js
node --check public/v03.js
node --check public/authority-core.js
node --check public/authority.js
node --check public/pilot-core.js
node --check public/pilot.js
node --check netlify/functions/evaluate.mjs
```

## Stack

Vanilla JavaScript · Netlify Functions · deterministic policy engine · browser-local state · WebMCP · OpenAction/OpenProof contracts · GitHub Actions

## License

MIT — see [`LICENSE`](./LICENSE).

---

Built as a public-interest prototype by **Michael Ninh** in Berlin.
