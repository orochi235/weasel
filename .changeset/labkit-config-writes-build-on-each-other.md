---
'@weasel-js/labkit': patch
---

When the settings panel, or a chrome contribution's `ctx.setConfig`, wrote several config paths before the next render (resetting a section does), an instrument's `onConfigChange` was handed the config with only the last write applied and the state from before the first, so the state it derived reflected one path. Each write now reads the trial's stored config and state, so every call sees the writes before it.
