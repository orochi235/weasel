---
'@weasel-js/forge': patch
---

Prop controls read a story's component props through TypeScript's compiler API, which TypeScript 7 no longer ships: its `typescript` package exports only its version. The optional `typescript` peer is now `>=5.0.0 <7`, and with TypeScript 7 installed the stories get no prop controls, as they do with no `typescript` at all, rather than failing to load with `Cannot read properties of undefined (reading 'fileExists')`.
