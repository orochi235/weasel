---
'@weasel-js/svg': patch
---

A conic gradient now survives an SVG round-trip. SVG has no element for one, so it serializes as a `<wzl:conicGradient>` def in `urn:weasel-js:svg` — declared on the root only when a document holds a paint that needs it — and parses back to the same fill. Previously the fill was omitted from `<defs>` with a warning and the `url(#id)` reference dangled, so the shape vanished in every viewer, weasel's own included.

Every reference to a paint SVG cannot express now carries SVG's paint fallback after it (`fill="url(#grad0) #ff0000"`), taken from the paint kind's `colorOf`, or `none` when it has none. A registered kind writing its own `toSvg` gets that envelope without doing anything. On import, a fallback beside a reference this package cannot resolve — Inkscape's mesh gradients, say — is read as a flat fill instead of being dropped with a warning.
