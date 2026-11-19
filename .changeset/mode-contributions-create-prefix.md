---
'@weasel-js/core': major
'@weasel-js/routing': major
---

The mode contribution factories are `createModeTriggersContribution` and `createModeShortcutsContribution`.

This is a breaking rename: `modeTriggers` (core) and `modeShortcuts` (routing, re-exported by core) are gone, with no alias. Their arguments are unchanged.

```tsx
// before
<SceneCanvas ambient={[modeShortcuts(modes, handlers), modeTriggers(modes, { enter })]} />
// after
<SceneCanvas ambient={[createModeShortcutsContribution(modes, handlers), createModeTriggersContribution(modes, { enter })]} />
```

<!-- entry: breaking api -->
