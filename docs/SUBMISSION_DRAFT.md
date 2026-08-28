# Benefit Bridge — WebMCP Challenge submission draft

> Replace bracketed placeholders after production launch. Do not submit until a visible open-source license is added to the standalone public repository.

## Project name

**Benefit Bridge — The public-service website your AI agent can use without inventing authority**

## Tagline

**Collect once. Preserve provenance. Prepare safely. Humans approve. Authorities decide.**

## Live URL

`[NETLIFY_PRODUCTION_URL]`

## Public repository

`[STANDALONE_PUBLIC_REPO]`

## Demo video

`[PUBLIC_YOUTUBE_URL]`

## Short description

Benefit Bridge explores what public services could look like when a website exposes trustworthy capabilities directly to AI agents instead of forcing them to scrape pages, infer form semantics and guess what actions are safe.

A person enters a synthetic household snapshot. Benefit Bridge deterministically surfaces source-linked benefit pathways, builds a reusable Benefit Passport, separates claims from evidence, and prepares a reviewable application packet with field provenance and blockers. The same capabilities are exposed through 11 read-only WebMCP tools.

The core authority contract is intentionally strict: **agents prepare; people authorise; authorities decide.** Benefit Bridge has zero submission tools, and even a fully reviewed packet reports `submissionAllowed: false`.

## Why this is a strong fit for WebMCP

Public-service websites are a particularly difficult environment for generic browser agents. The user’s intent may be simple — “what help can I get and what do I need to do next?” — but the workflow spans rules, forms, evidence, repeated household data and consequential actions.

Without WebMCP, an agent must scrape prose, inspect UI controls and infer which interactions are safe. Benefit Bridge instead exposes structured tools with explicit JSON schemas, descriptions, read-only annotations and deterministic server validation.

The WebMCP layer is not a separate agent-only backend. It wraps the same capability surface used by the human interface, so people and agents cannot silently receive different rules.

## Better user experience

Benefit Bridge reduces four common forms of friction:

1. **Repeated facts** — household claims become a reusable Benefit Passport.
2. **Opaque evidence requirements** — claims and supporting evidence remain visibly separate.
3. **False certainty** — preliminary signals remain signals; they never become authority awards.
4. **Unsafe automation** — the agent can prepare and validate a packet, but cannot submit it.

For the Berlin demo household — a single parent with two children, €2,000 gross monthly income and €1,100 warm rent — the experience shows:

- €518/month known Kindergeld anchor
- up to €594/month KiZ worth checking, explicitly labelled as a maximum rather than entitlement
- Wohngeld routed to an official calculation instead of a guessed number
- Bildung & Teilhabe shown only as a conditional downstream right

## What humans and agents can do together now

A human can:

- enter or review household claims
- see source-linked benefit pathways
- mark evidence categories as prepared
- inspect how evidence can be reused across services
- review pre-filled application fields and their provenance
- resolve missing human details
- explicitly approve a local export packet

An agent can:

- check preliminary benefit pathways
- calculate only pinned/justified amounts
- list missing evidence
- explain the deterministic trace
- prepare safe next steps
- derive and inspect the Benefit Passport
- plan a service application
- prepare an application packet
- validate the packet after human review

An agent cannot:

- sign for the user
- authenticate as the user
- upload documents to an authority
- submit an application

## WebMCP implementation

Benefit Bridge uses the current imperative API:

`document.modelContext.registerTool(...)`

Eleven read-only tools are registered:

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

The website uses a stateless Netlify Function for household evaluation. The Application Studio combines identity/contact data browser-locally so that applicant PII is not required by the benefit-evaluation endpoint.

## Trust architecture

```text
claim
  ↓
evidence
  ↓
derived signal
  ↓
prepared application field
  ↓
human review manifest
  ↓
authority decision (outside Benefit Bridge)
```

This separation is regression-tested. Prepared evidence never becomes “verified by authority,” an eligibility signal never becomes an award, and approval never changes `submissionAllowed` to true.

## Technical proof

- deterministic/versioned benefit policy pack
- source-linked results
- stable trace, passport and packet IDs
- replayable rule trace
- browser-local identity/application layer
- Netlify Function for shared server capability
- 17 deterministic tests plus end-to-end smoke flow
- GitHub Actions launch checks
- CI guard against consequential submit/sign/auth/upload tool names
- explicit human review gate
- 11 WebMCP tools / 0 submission tools

## Judging criteria

### WebMCP Leverage
WebMCP is the interaction contract, not decoration. The project exposes a non-trivial set of structured capabilities spanning orientation, provenance, evidence preparation and application-packet validation.

### Execution
The project is a coherent human-facing product with a deterministic backend, reusable passport, Application Studio, WebMCP tool surface, tests, CI and deployment configuration.

### Potential Impact
Millions of people interact with benefits and public-service systems where missing information, repeated evidence and unclear next steps create avoidable friction. Benefit Bridge demonstrates a safer agent-native pattern for those workflows.

### Creativity & Ambition
Rather than automating form clicks, Benefit Bridge treats **authority itself as part of the interface contract**. The central design question is not merely “can an agent do this?” but “what should an agent be allowed to prepare, and what must remain explicitly human or institutional?”

## Demo video

Use `docs/DEMO_SCRIPT.md` (~75 seconds). Keep the final public video under 3 minutes and include audio.

Final proof moment:

> **11 read-only WebMCP tools. Zero submission tools. Agents prepare; people authorise; authorities decide.**

## Pre-submit checklist

- [x] working implementation
- [x] WebMCP uses `document.modelContext.registerTool(...)`
- [x] deterministic tests / smoke flow
- [x] GitHub launch CI green
- [x] challenge demo script
- [ ] open-source license approved and added
- [ ] standalone public repository created
- [ ] live production URL created
- [ ] production API smoke passed
- [ ] native WebMCP verified on production
- [ ] public YouTube demo uploaded
- [ ] final URLs inserted above
- [ ] Devpost submission saved and reviewed
