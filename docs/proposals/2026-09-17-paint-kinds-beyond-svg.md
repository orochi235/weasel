# Paint kinds beyond SVG

Status: research. Nothing built here beyond the serialization mechanism described
under "The gap this closed"; the paint model itself is undecided.

For someone extending weasel's paint kinds, or choosing a serialization format for
scenes whose paints SVG cannot express. It answers: what SVG can and cannot carry,
why its mesh gradients died, what PDF's shading model has instead, and which parts
of all that weasel's existing registry can already hold.

## The gap this closed

`PaintKind` is open on the string and `registerPaintKind` takes a kind with two
serialization-relevant slots: `bind`, which returns a compiled GL program, and
`toSvg(id, fill)`, which returns the `<defs>` entry a `url(#id)` reference resolves
to. Five kinds ship: `solid`, `linear-gradient`, `radial-gradient`,
`conic-gradient`, `pattern`.

**One of those five has no SVG form at all.** SVG has `linearGradient` and
`radialGradient` and nothing else — conic gradients exist in CSS, not in SVG — so a
conic fill used to serialize as a `url(#id)` pointing at a def that was never
written, and the shape vanished in any viewer.

`@weasel-js/svg` now writes option 1 below for it: a `<wzl:conicGradient>` def in
`urn:weasel-js:svg`, declared on the root only when a document holds a paint that
needs it, with SVG's own paint fallback color after the reference. It reads that def
back, so weasel round-trips a conic gradient losslessly and everything else paints
the fallback. A registered kind's `toSvg` gets the same envelope for free — the
fallback comes from its `colorOf`, and `none` when it has none.

That is the envelope, not the paint model. Anything richer than a conic gradient
still has to decide what goes *inside* the def, which is what the rest of this
document is about.

## SVG's mesh gradients, and why they are not the answer

SVG 2 drafts specified `<meshgradient>` holding `<meshrow>` holding `<meshpatch>`
holding up to four `<stop>` elements, each stop carrying one patch edge as relative
path data plus a corner color: Coons patches, twelve control points and four colors
each.

It was cut from SVG 2 and parked in svg-next because W3C wants two independent
implementations and only Inkscape ever shipped one. No browser implemented it;
Mozilla's tracking bug sat open and unstaffed. As of February 2026 the working group
was proposing to delete even the web-platform tests for the three elements.

Two things to know before writing a reader or a writer for it:

- **Edges are shared implicitly.** A patch omits the edges it inherits from its left
  neighbor and from the row above, so the first patch of the first row declares four
  edges, later patches in a row declare three, and interior patches declare two. A
  naive writer emits redundant edges; a naive reader misassigns corner colors, and
  the result looks subtly torn rather than plainly broken. Inkscape's behavior is the
  only conformance oracle.
- **Paint fallback keeps the file viewable.** Written as
  `fill="url(#mesh1) #c04a3f"`, a renderer that cannot resolve the reference — every
  browser — takes the fallback color instead of dropping the fill. Any custom paint
  serialized into SVG should carry one.

## What PDF has instead

PDF's shading model is the richest of the mainstream vector formats. The taxonomy is
ISO 32000-1 §8.7.4.5; functions are §7.10.

| Type | Shading | What it adds |
|---:|---|---|
| 1 | Function-based | A color at every point from an arbitrary function over a domain |
| 2 | Axial | The linear gradient |
| 3 | Radial | Two circles, so cones and spheres, not only concentric rings |
| 4 | Free-form Gouraud triangles | Arbitrary triangle soup, per-vertex colors |
| 5 | Lattice-form Gouraud triangles | The same on a regular grid, cheaper to encode |
| 6 | Coons patch mesh | Twelve control points per patch — what SVG's mesh element was |
| 7 | Tensor-product patch mesh | Sixteen control points, so the patch interior is controllable too |

Three capabilities have no SVG equivalent:

- **A type 1 shading with a type 4 function is a shader.** PDF functions come as
  sampled, exponential, stitching, and type 4 — a small PostScript program the
  renderer evaluates per point. This shipped in 1993.
- **Interpolation is not stuck in sRGB.** A shading names its own color space, so it
  can interpolate in Lab, ICCBased, Separation or DeviceN. A gradient between two
  spot inks, blended in the right space, is simply not expressible in SVG.
- **Shadings compose with transparency.** Any shading can drive a soft mask from an
  arbitrary form XObject, so a mesh can be the transparency of something else rather
  than its color. Transparency groups and blend modes live in the same model.

Where SVG is better: **spread methods.** SVG gives `pad`, `reflect` and `repeat`
directly; PDF's `Extend` is two booleans for clamping at the ends, and anything
repeating has to be built from a stitching function or a tiling pattern.

## Rasterizing it is a library call

Cairo ships mesh patterns: `cairo_pattern_create_mesh` builds tensor-product patch
meshes and also serves for Coons patches and Gouraud triangles — PDF types 7, 6 and
4/5 respectively. A patch is `begin_patch`, four `curve_to` edges, four
`set_corner_color_rgb`, `end_patch`. Inkscape displaying mesh gradients at all is
this API.

Reaching it depends on the binding, and this is the part to check before planning
around it:

- **pycairo** exposes it as `cairo.MeshPattern`. The shortest path to experimenting.
- **cairo-rs** exposes `cairo::Mesh` with the same shape.
- **node-canvas** is Cairo-backed but implements the browser's Canvas 2D surface,
  which has no mesh patterns — so the package most likely to be in a JS pipeline
  probably cannot reach the feature the library underneath it has. Unverified;
  check before relying on either answer.
- **resvg** shows no sign of mesh support in its docs or changelog. Assume it renders
  nothing.

Because Cairo's patch types *are* PDF's shading types, anything modeled this way
exports to PDF nearly losslessly, which is the opposite of SVG's situation.

## What this would mean here

The registry already has the shape. A mesh or function-based kind needs `seed`,
`colorOf`, `bind`, and the `inPoseFrame`/`toBoundsFrame` pair — all slots that
exist — plus a `toSvg` that has to invent something, since SVG has no element to
target. The open question is only what that slot writes:

1. **A private-namespace element in `<defs>`**, referenced by `url(#id)` with a paint
   fallback color after it. Round-trips through weasel losslessly, degrades to flat
   color everywhere else, and keeps the file valid SVG. This is what conic gradients
   now do, so a richer kind inherits the envelope and writes only its own element.
2. **The dead `<meshgradient>` vocabulary**, for the one case where interop with
   Inkscape is worth more than generality. Costs the implicit-edge work above and
   only covers Coons patches.
3. **Flatten on the way out** — approximate the paint as a raster or as many
   Gouraud triangles. Lossy, and the scene can no longer be edited from its own
   serialization, which defeats the purpose.

If a richer paint model is wanted, the model worth copying is **PDF's taxonomy, with
SVG as syntax rather than as the source of the vocabulary**: tensor patches and
function shadings in one family, Cairo speaking types 4 through 7 already, and PDF
export near-lossless. Adopting SVG's abandoned element instead buys Inkscape
compatibility and stops at Coons.

## Open

- Whether weasel wants paint kinds richer than its five at all.
- Whether the `bind` slot's single compiled program per kind is enough for a
  function-based paint, or whether such a kind needs to compile per fill.
- What a private-namespace `<defs>` element costs the scene-serialization path in
  `docs/scene-serialization.md`, which is JSON and does not have this problem.
