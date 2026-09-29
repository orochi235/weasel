---
"@weasel-js/svg": patch
---

`<style>` rules inside `@media` and `@supports` now apply when their condition
holds, nested to any depth, where before every at-rule was skipped. A parse is
evaluated as one static render: by default a `screen` whose viewport is the
root's `width`/`height` (else its `viewBox`, else 300 × 150), with a light color
scheme and no hover or pointer. The new `ParseOptions.media` overrides any part
of that. Media queries follow Media Queries 4, including the range syntax
(`(400px < width <= 800px)`); an unknown feature never matches. `@supports`
holds only for declarations this parser honors. `<style media>` goes through
the same evaluator, so `media="screen and (min-width: 500px)"` works now too.
`@import` is still not fetched, and each one now adds an entry to `warnings`.

This is additive. One behavior change: an SVG whose stylesheet has a matching
`@media`/`@supports` block now renders those rules. New exports:
`evaluateMediaQuery`, `DEFAULT_MEDIA_ENVIRONMENT`, `SvgMediaEnvironment`,
`evaluateSupports`, `SupportsOptions`.
