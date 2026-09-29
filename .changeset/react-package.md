---
"@weasel-js/react": patch
"@weasel-js/routing": patch
---

New package `@weasel-js/react`: generic React hooks with no weasel domain in
them, at the bottom of the package stack so every React-using package can reach
them. It holds `useLatest` and `useStableByContent` (with its `sameList`
comparator), which keeps one identity for a value rebuilt equal every render,
compared only against what last committed.

`@weasel-js/routing/react` no longer exports `useLatest`; import it from
`@weasel-js/react`, or from `@weasel-js/core` as before. No released version of
routing carried it, so nothing published breaks. `@weasel-js/react` takes
`react` as a peer, so installing `@weasel-js/routing` now brings a React peer
requirement with it even when only its React-free main entry is used.
