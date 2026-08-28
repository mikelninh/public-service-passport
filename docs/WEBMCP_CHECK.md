# Native WebMCP production check

Chrome currently exposes WebMCP through `document.modelContext`. For local/testing use, enable `chrome://flags/#enable-webmcp-testing`, relaunch Chrome, open the Benefit Bridge production URL, then run:

```js
const tools = await document.modelContext.getTools();
console.table(tools.map(({ name, annotations }) => ({ name, readOnly: annotations?.readOnlyHint })));
tools.length;
```

Expected result: **11 tools**, all with `readOnly: true`.

Benefit Bridge intentionally exposes no submit, sign, authenticate, or upload-to-authority tool.
