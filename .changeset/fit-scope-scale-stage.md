---
'@weasel-js/ui': minor
---

A fit scope can print its members at one scale, the smallest any of them needs, with `useFitScope(ref, { scale })`.

`scale` takes `min`, the floor, and `property`, the custom property the shared scale is published on, on the scope's element. A member joins through `useFitScale()`, which returns the nearest scope's stage (a nested scope without one passes its outer scope's on), with `join(id, { el, measure, onFit })`; `measure` returns `{ scale, shared }`, and a member with `shared: false` sizes itself. `KeyBank` is now such a scope, so a `KeyCap` inside any scope with a scale stage fits its legend, and a `FitLabel` inside a `KeyBank` steps with the bank's other labels.

```tsx
const ref = useRef<HTMLDivElement>(null);
const fit = useFitScope(ref, { scale: { min: 0.6, property: '--legend-scale' } });
return <div ref={ref}><FitScope value={fit}>{children}</FitScope></div>;
```

<!-- entry: api new -->
