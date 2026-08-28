# Native WebMCP proof

Verified in Chrome on 2026-08-28 against the public production site:

https://public-service-passport.netlify.app

`document.modelContext.getTools()` returned **11 tools** and every discovered tool reported `annotations.readOnlyHint === true`.

## Discovered tools

1. `calculate_support`
2. `check_eligibility`
3. `derive_benefit_passport`
4. `explain_result`
5. `get_passport_status`
6. `list_missing_evidence`
7. `plan_application`
8. `prepare_application_packet`
9. `prepare_next_steps`
10. `replay_case`
11. `validate_application_packet`

Observed console result:

```text
TOTAL: 11
```

All 11 tools were read-only.

## Verification snippet

```js
const tools = await document.modelContext.getTools();

console.table(
  tools.map(t => ({
    name: t.name,
    readOnly: t.annotations?.readOnlyHint
  }))
);

console.log("TOTAL:", tools.length);
```

This is a runtime discovery proof, not merely a source-code count. The production site still exposes zero submit/sign/authenticate-as-user/authority-upload WebMCP tools.
