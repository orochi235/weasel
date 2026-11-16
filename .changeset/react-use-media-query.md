---
'@weasel-js/react': minor
---

`useMediaQuery(query)` answers whether a CSS media query matches, and re-renders when that changes.

`matchesMedia` and `watchMedia` do the same for code outside React.

```ts
const wide = useMediaQuery('(min-width: 600px)');
const coarse = useMediaQuery('(pointer: coarse)', { fallback: false, follow: true });
```

`fallback` is the answer with no `matchMedia` (a server render, jsdom); `follow: false` subscribes to nothing. `usePrefersReducedMotion` and `useSystemColorScheme` are built on it.

<!-- entry: api -->
