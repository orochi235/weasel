---
'@weasel-js/ui': patch
---

Document every public export of `@weasel-js/ui` with a JSDoc string at its
definition site, so editor hover and the generated API reference say what each
component, prop bag and helper is for.

No behavior, names or exports changed. Where a component's live-versus-committed
callback pair is spelled differently from its neighbors' — `Slider`'s
`onChange`/`onCommit` against `GradientEditor`'s `onInput`/`onChange` — the
docstring records which sense that component uses rather than smoothing it over.
