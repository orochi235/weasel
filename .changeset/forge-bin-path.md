---
"@weasel-js/forge": patch
---

Drop the `./` from the `weaselforge` bin path, so publishing stops warning.

npm normalizes `./dist/cli.js` to `dist/cli.js` and reports it as
`"bin[weaselforge]" script name dist/cli.js was invalid and removed`. Nothing
was removed — the published manifest has always carried a working bin — but the
wording reads as a broken CLI, which is worth not printing on every release.
