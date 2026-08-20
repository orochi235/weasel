---
'@weasel-js/labkit': patch
---

`@weasel-js/labkit/styles.css` now carries styles for the components labkit
passes through. It previously held only labkit's own `.lk-*` chrome, so anything
reached via `@weasel-js/labkit/weasel-ui` arrived with class names matching no
rule — a `Slider` rendered as a zero-height track with unpositioned thumbs — and
nothing errored anywhere. The import path is unchanged; a consumer already
importing it gets the fix by upgrading.

The stylesheet is now three layers: `@weasel-js/theme` tokens (the `--wzl-*`
custom properties weasel-ui's rules read), weasel-ui's compiled CSS modules, then
labkit's chrome last so it overrides what it wraps. Layer two is taken from the
same `@weasel-js/ui` build tsup bundles the JS out of, since CSS-module class
names are minted per build and the two have to match.

The consumer smoke test holds this: every scoped class name in the shipped
bundle must have its module's rules present in the shipped stylesheet.
