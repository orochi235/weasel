---
'@weasel-js/labkit': patch
---

A schema can say a section opens folded: `.section('Advanced', { collapsed: true })`.

The fold itself already worked and already persisted per trial; what a schema
could not do was start a section closed, which is what an "Advanced" heading
full of knobs nobody opens on the first run wants. Say `collapsed` on any one
leaf under the heading — the section it names takes it, and the rest of the
leaves keep saying `.section('Advanced')`.

A section that declares how it opens is foldable on its own, with no
`collapse` / `collapsed` / `onCollapse` on the panel. A fold the reader has
since toggled still wins, so a lab that remembers a trial's sections is
unaffected.

`NodeOptions.section` is now `{ label, collapsed? }` rather than a bare string.
The builder's `.section()` is the way this is written; a schema that reaches
into `options.section` directly reads `.label`.
