---
"@weasel-js/core": patch
---

Cmd/Ctrl+V now pastes on a `<SceneCanvas>` with the `edit` preset and without `ingest`. This changes behavior: such a canvas could copy and cut to the OS clipboard and ignored a paste. It now pastes the nodes a kit canvas copied, from the same tab or another, and nothing else. A pasted image, SVG, or file, a consumer's `ingestion.handlers`, and every OS drop still need `ingest`. `ingestion.clipboard` (`reviver`, `enabled: false`) applies to it as it does under `ingest`.

The new `clipboard.pasteEvent` action does this, bound to a `paste` event carrying `text/plain`, and `clipboardPasteEventAction` is exported. `useStandardActions` registers it only while `ingest` is excluded, since `ingest` binds the same event and accepts that payload among the rest; a canvas with both presets behaves as before. `KIT_STANDARD_ACTION_IDS` lists it, so the hook with no `exclude` now registers one fewer action than that list names.
