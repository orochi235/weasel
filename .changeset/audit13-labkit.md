---
'@weasel-js/editor': patch
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Fixes to the editor's page stepping, forge's API panel and labkit's job readout.

- `usePages().step` steps from the page last shown while the view sits between pages, as `add` already did. Before, the next page from a gap was always the first page and the previous one always the last.
- forge's API panel escapes a quote inside a string literal type it prints from TypeDoc's JSON (an overload's signature), showing `'it\'s'` rather than `'it's'`.
- `<JobProgress>` sizes its count for the job's total, so the failure count and Cancel button after it stay put as the count gains digits.
