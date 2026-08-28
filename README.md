# Benefit Bridge 🌉

**The public-benefits website an AI agent can use without inventing authority.**

Benefit Bridge is a WebMCP challenge proof for agent-native public services. V0.3 adds an **Application Studio** on top of the Benefit Passport: the system can prepare a reviewable application packet with field provenance, evidence bindings, blockers and an explicit human approval gate — without adding an autonomous submit tool.

## V0.3 — From passport to reviewable packet

```text
household claims
      ↓
deterministic benefit signals
      ↓
Benefit Passport
  ├─ self-attested claims
  ├─ evidence map
  ├─ reuse matrix
  └─ rights graph
      ↓
Application Studio (browser-local identity layer)
  ├─ pre-filled fields + provenance
  ├─ evidence bindings
  ├─ unresolved fields / blockers
  ├─ official-service components
  └─ human review manifest
      ↓
local JSON export
      ↓
human opens official service
```

**There is deliberately no “submitted” state inside Benefit Bridge.**

## Berlin demo

Synthetic household: single parent · children 7 + 12 · €2,000 gross/month · €1,100 warm rent.

- **€518/month known Kindergeld anchor** — 2 × €259
- **up to €594/month KiZ worth checking** — maximum anchor, not entitlement
- **Wohngeld → official check** — no guessed statutory amount
- **Bildung & Teilhabe → conditional downstream right** if KiZ/Wohngeld is actually awarded; 2026 school-supplies anchor: **€195/year**

The Application Studio uses a clearly synthetic local-only applicant (`Mara Beispiel`) for the challenge flow.

## What V0.3 proves

### 1. Pre-fill without erasing provenance
A packet field sourced from the Benefit Passport stays labelled `self_attested_claim`. Local applicant identity/contact data is labelled `local_human_input`. A derived benefit signal is labelled `deterministic_policy`.

### 2. Missing information stays missing
The packet can be `draft_blocked`. It exposes missing evidence and unresolved human fields instead of inferring them.

### 3. Evidence readiness is not verification
A user can mark an evidence category **prepared by human**. Benefit Bridge never upgrades that to “verified by authority”.

### 4. PII can stay browser-local
Household benefit evaluation stays server-side and stateless. Applicant name/address/contact details are combined into the packet by `public/packet-core.js` in the browser. They are not required by `/api/evaluate`.

### 5. Human approval is a separate state
Three explicit confirmations are required before local export:

- claims/details reviewed
- evidence statuses reviewed
- “this is not submission” understood

Even after approval, `submissionAllowed` remains **false**.

## WebMCP surface — 11 read-only tools, 0 submission tools

1. `check_eligibility`
2. `calculate_support`
3. `list_missing_evidence`
4. `explain_result`
5. `prepare_next_steps`
6. `replay_case`
7. `derive_benefit_passport`
8. `get_passport_status`
9. `plan_application`
10. `prepare_application_packet`
11. `validate_application_packet`

The human UI and the two packet WebMCP tools share the same browser-local packet core.

## Official-flow grounding

Current official pages are used only to anchor the preparation model, not to claim that Benefit Bridge reproduces the authority forms exactly.

- Bundesagentur für Arbeit: KiZ online/forms page lists a **main application**, a **child annex per child**, and an **applicant/partner annex**.
- KiZ-Lotse asks about children, basic-security receipt, income and rent, while explicitly not calculating the final KiZ amount.
- Berlin Wohngeld guidance asks for identity documents, rental documents, recent rent-payment evidence and household income evidence.
- Berlin's service supports an online application and a generated PDF copy, but Benefit Bridge does not automate that submission step.

Source URLs are embedded in the policy/packet schemas.

## Run locally

```bash
npm run dev
# http://localhost:8888
```

## Verify

```bash
npm run check
node --check public/app.js
node --check public/packet-core.js
node --check netlify/functions/evaluate.mjs
```

Current deterministic suite: **17 tests** plus an end-to-end smoke case across household → passport → packet → human review validation.

The suite covers:

- Berlin benefit anchors
- policy boundaries
- stable trace/passport/packet IDs
- claims vs evidence
- downstream-right conditionality
- official-flow evidence requirements
- field provenance
- blocked vs ready-for-review packet states
- explicit review confirmations
- browser-local packet preparation
- `submissionAllowed === false` after approval

### Verification boundary

Engine, API shape, client packet core, JavaScript syntax and deterministic integration tests are runnable here. Automated Chromium visual E2E is not claimed in the current build environment because the preferred `agent-browser` binary is unavailable here. The app includes an in-page WebMCP contract harness for manual review.

## Privacy / authority boundary

- server is stateless
- no identity documents are uploaded
- no real documents are retained
- Benefit Passport save requires explicit browser-local action
- Application Studio identity/contact fields are browser/session-local
- packet export requires explicit human approval
- export is JSON only; it is **not** sent to an authority
- no WebMCP tool signs, authenticates, uploads or submits an application

## Why this matters

Public services often make people repeat facts and then make software pretend that repetition equals certainty. Benefit Bridge explores a different contract:

> **collect once → preserve provenance → prepare safely → expose blockers → review explicitly → hand off to the real authority**

Built as a public-interest WebMCP proof by Michael Ninh in Berlin.
