---
'@weasel-js/labkit': patch
---

labkit's `dist` no longer inlines any `@weasel-js` package. It used to bundle every sibling but
core, theme, and the animator, so an app holding labkit and, say, `@weasel-js/quantity` ran two
copies: a display kind registered with `registerDisplayKind` was unknown inside labkit, and
`@weasel-js/ui`'s `RecentColorsProvider` and overlay portal host existed twice. Every sibling is
now an import the consumer's install resolves, which it already was in the declarations.

Breaking for a consumer that relied on the bundle: a page loading labkit's `dist` with no package
resolution now needs labkit's dependencies resolvable too.
