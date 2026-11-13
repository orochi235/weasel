---
'@weasel-js/core': major
---

`ChromeCtx` and `buildChromeCtx` are removed: `resolveVisibility` takes a `RuleCtx`, which `buildRuleCtx` assembles, and no longer fills in a mode for a context without one.

```ts
// before
resolveVisibility(rules, buildChromeCtx({ focused, selection, multiActive, modifiers, action, hover, view }));
// after
resolveVisibility(rules, buildRuleCtx({
  focused, selection, multiActive, modifiers, action, hover,
  zoom: viewZoom(view), mode: 'normal', allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES,
}));
```

<!-- entry: breaking -->
