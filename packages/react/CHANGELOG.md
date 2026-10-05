# @weasel-js/react

## 1.8.0

No changes in this release.

## 1.7.3

No changes in this release.

## 1.7.2

No changes in this release.

## 1.7.1

### Patch Changes

- d175c0c: New package `@weasel-js/react`: generic React hooks with no weasel domain in
  them, at the bottom of the package stack so every React-using package can reach
  them. It holds `useLatest` and `useStableByContent` (with its `sameList`
  comparator), which keeps one identity for a value rebuilt equal every render,
  compared only against what last committed.
  
  `@weasel-js/routing/react` no longer exports `useLatest`; import it from
  `@weasel-js/react`, or from `@weasel-js/core` as before. No released version of
  routing carried it, so nothing published breaks. `react` is an optional peer
  of `@weasel-js/react`, as it is of routing and theme, so installing routing for
  its React-free main entry still brings no React.
- 4cef954: New `useLatest(value)` (`@weasel-js/react`, re-exported by
  `@weasel-js/core`): a ref holding the value of the last committed render, for
  event handlers and frame loops that must not re-subscribe when it changes.
  Unlike writing `ref.current = value` in the render body, a render React throws
  away never lands, and the value is in place before any layout effect of the
  commit runs. List the returned ref in dependency arrays; `exhaustive-deps` only
  treats `useRef` as stable.
