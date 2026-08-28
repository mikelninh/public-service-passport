# Public Service Passport 🇩🇪

**Tell public services once. Reuse it safely.**

A working Berlin pilot that helps families understand possible public benefits, see what is known vs. uncertain, prepare the right evidence, and create a reviewable application draft — while keeping the final decision with the person and the authority.

👉 **Live:** https://public-service-passport.netlify.app/

## Why this exists

Public services repeatedly ask people for the same facts: household, children, income, rent, evidence. Citizens then have to work out which benefit might apply, which document is needed where, and what is actually certain.

Public Service Passport explores a simpler model:

> **enter facts once → preserve provenance → reuse with permission → prepare safely → human approval → authority decision**

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

**claim → evidence → derived signal → prepared application field → human review → authority decision**

Key rules:

- self-entered facts stay labelled as self-attested
- prepared evidence is never called authority-verified
- missing information stays missing
- unsupported geography fails closed instead of reusing Berlin rules
- browser-local applicant identity/contact data does not need to be sent to `/api/evaluate`
- packet approval never changes `submissionAllowed: false`
- the server is stateless

## Proof, not just claims

The current release has been tested at multiple layers:

- **47/47 deterministic, integration and adversarial tests passing**
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
- responsive desktop + 390 px mobile browser QA
- native Chrome WebMCP discovery: **11/11 tools, all read-only**
- external production browser run against the public Netlify deployment

The production browser test clicked the real **Unterstützung prüfen** CTA and verified the expected Berlin demo result, Passport visibility and Application Studio visibility with zero product runtime errors.

## Scope

This is a **working Berlin public-benefits pilot**, not a complete German entitlement engine.

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

Future directions
├─ Housing
├─ Family & childcare
├─ Health & care administration
└─ Identity & documents
```

Final entitlement and all binding decisions remain with the responsible authority.

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
node --check public/v03.js
node --check netlify/functions/evaluate.mjs
```

## Stack

Vanilla JavaScript · Netlify Functions · deterministic policy engine · browser-local state · WebMCP · GitHub Actions

## License

MIT — see [`LICENSE`](./LICENSE).

---

Built as a public-interest prototype by **Michael Ninh** in Berlin.
