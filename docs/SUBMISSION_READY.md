# Public Service Passport — WebMCP Challenge submission-ready snapshot

## Project

**Public Service Passport**

Benefit Bridge is the first working module: a safer agent-native way to discover public support, reuse evidence, and prepare applications without inventing authority.

## Tagline

**Tell public services once. Reuse it safely.**

## Live production

https://public-service-passport.netlify.app

## Public repository

https://github.com/mikelninh/public-service-passport

## Demo video

Pending public YouTube upload.

## Core proof

- 11 native WebMCP tools discovered at runtime in Chrome
- all 11 report `annotations.readOnlyHint === true`
- 0 submit/sign/authenticate-as-user/authority-upload tools
- deterministic benefit evaluation
- source-linked benefit pathways
- reusable Benefit Passport with claims/evidence separation
- provenance-aware Application Studio
- explicit human approval gate
- `submissionAllowed: false` remains invariant
- MIT licensed
- 17 deterministic tests + smoke flow
- GitHub Actions launch checks

## Native WebMCP runtime verification

Verified on 2026-08-28 against production with:

```js
const tools = await document.modelContext.getTools();
console.table(tools.map(t => ({
  name: t.name,
  readOnly: t.annotations?.readOnlyHint
})));
console.log("TOTAL:", tools.length);
```

Observed:

```text
TOTAL: 11
```

All 11 rows returned `readOnly: true`.

See `docs/NATIVE_WEBMCP_PROOF.md` for the discovered tool list.

## Demo household

Synthetic Berlin household:

- single parent
- two children, ages 7 and 12
- €2,000 gross household income / month
- €1,100 warm rent / month
- currently receives Kindergeld

The demo surfaces:

- €518/month known Kindergeld anchor
- up to €594/month KiZ worth checking — explicitly not an entitlement
- Wohngeld routed to an official check rather than a guessed amount
- Bildung & Teilhabe shown as a conditional downstream right

## Authority contract

> **Agents prepare. People authorise. Authorities decide.**

The agent can inspect, explain, calculate pinned amounts, identify evidence, derive the passport, plan applications, prepare packets and validate them. It cannot submit an application or impersonate the user.

## Final remaining gates

- [x] public production URL
- [x] public standalone repository
- [x] MIT license
- [x] CI green
- [x] deterministic tests + smoke
- [x] native WebMCP runtime proof: 11/11 read-only
- [x] demo script
- [ ] public YouTube demo uploaded
- [ ] final Devpost submission reviewed and submitted
