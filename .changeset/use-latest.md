---
"@weasel-js/routing": patch
"@weasel-js/core": patch
---

New `useLatest(value)` (`@weasel-js/routing/react`, re-exported by
`@weasel-js/core`): a ref holding the value of the last committed render, for
event handlers and frame loops that must not re-subscribe when it changes.
Unlike writing `ref.current = value` in the render body, a render React throws
away never lands, and the value is in place before any layout effect of the
commit runs. List the returned ref in dependency arrays; `exhaustive-deps` only
treats `useRef` as stable.
