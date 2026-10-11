---
'@weasel-js/core': patch
---

`useLassoTool` no longer takes an adapter: its first argument was never read, so the call is now `useLassoTool(options)`. `useHandTool` returns `Tool<null>` in place of a scratch type nothing populated. Both are breaking changes to the signatures.
