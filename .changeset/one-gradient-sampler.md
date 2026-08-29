---
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

The canvas and the gradient editor now sample one gradient

`buildGradientRamp` carried its own interpolation beside
`sampleGradientStops`, and the two disagreed three ways: the ramp had no guard
at either end and extrapolated past the first and last stop, the two picked
opposite sides of a coincident pair, and they parsed color differently — a stop
written as a CSS named color rendered on the canvas and threw in the editor.

`sampleGradientStops` keeps its semantics and is now the only implementation.
`resolveGradientStops` sorts and parses the list once; `sampleResolvedStops`
returns the color at `t`. The ramp cache builds its texels through those, so
there is no interpolation math left in the renderer.

Two behavior changes worth naming. `resolveColor` is the surviving parser, so
gradient stops accept named and functional colors everywhere — but no longer
hex without a leading `#`, which only the editor path had tolerated and the
canvas never accepted. And `sampleGradientStops` returns normalized hex at the
endpoints instead of echoing the raw stop string, so `'red'` comes back as
`'#ff0000'`.

**SVG export:** a conic gradient left the exporter as a dangling `url(#…)` —
the element already carried the reference, the built-in serializer returned
nothing, and the registry's `toSvg` slot has no in-repo implementation, so the
shape disappeared in a browser with no warning at all. Serialization now falls
through to the same warning the pattern path already emits when nothing can
produce a paint server. A consumer that registers a `toSvg` for
`conic-gradient` still serializes and gets no warning.
