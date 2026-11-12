---
"@weasel-js/ui": minor
---

A text field's `inputWaitMs` holds `onInput` until typing pauses that long.

Whatever is still waiting is sent when the edit settles, before `onChange`. `prefFieldProps` and `withCommitPolicy` take a `textWaitMs` that sets it on text a surface leaves live, and a form's or panel's render context carries `textWaitMs` beside `settles`. `useDebouncedText` also returns `flush`.

<!-- entry: api -->
