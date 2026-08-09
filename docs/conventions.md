 # API conventions

Project-wide API design rules for weasel. Add new entries as patterns
emerge — keep each one short, with a rule and a brief rationale.

## Terminology

- **`d`** — shorthand throughout these docs (and the API, e.g.
  `pathFromD`) for **SVG path data**: the string held by SVG's `d`
  attribute (`"M0 0 L100 0 Z"`). When you see "`d` string" or "a `d`",
  it means SVG path data, not a kit-invented format. See *Compose scenes
  in a terse path language* below for why this is the geometry surface.

## Defaults stay explicitly declarable

Props, attributes, and config fields with default values must still
accept the default being passed explicitly. Don't reject, warn, or
treat `tool="none"` (when `"none"` is the default) as redundant.

**Why.** Explicit declaration is a clarity tool — readers shouldn't
have to know the default to understand intent. It lets demos and
consumers self-document.

**Scope.** Applies to React component props, HTML attributes, and JS
config objects. Does *not* apply to positional function arguments or
anywhere requiring explicit defaults would cause organizational chaos.

## Compose scenes in a terse path language, not builder calls

We want the **expressive power of a path language** at the composition
boundary — but **without minting a new external standard** for consumers
to learn or for us to document, version, and maintain. The resolution is
to adopt the path language the world already speaks: **SVG `d` syntax.**
It's universal, needs no learning, and the kit parses it into a `Path`
via `pathFromD(d)`. A bespoke weasel path DSL — even a
"small" compact literal grammar — is exactly the wrong move: it's a new
standard wearing a terse costume.

So a composer gets a **choice**, and the terse end of it is just SVG:

1. **Terse declarative form — SVG `d`.** Declare a shape inline,
   `pathFromD("M0 0 L100 0 L100 100 Z")`, and hand it to a scene/op API.
   Full path-language expressiveness, zero new vocabulary. Usually the
   right default.
2. **Imperative builders.** `PathBuilder`, `polygonFromPoints`,
   `rectPath`, `ellipsePath`, `regularPolygonPath`, `starPath`,
   `linePath` remain a first-class choice — sometimes the clearest one.
   For a quick triangle `polygonFromPoints([[0,0],[10,0],[5,10]])` may
   read better than a string, and for *computed* geometry (loops,
   parametric shapes) a builder is the natural fit. These are ordinary
   function calls with plain args — not a grammar — so they cost no new
   standard either. The terse form makes them less frequently
   *necessary*, not unavailable.
3. **Typed-array `Path` (internal performance form).** The
   `commands: Uint8Array` / `coords: Float32Array` command stream
   (`packages/core/src/features/paths/types.ts`) is for the kit's monomorphic hot loops
   and low GC pressure. A consumer can reach for it for power, but is
   never required to construct or read it by hand.

Two principles, both load-bearing: **choice** (don't push a composer
toward a builder for simple authored geometry because nothing terser
exists) and **no new standard** (reach the power through SVG `d`, which
every consumer already knows, rather than a kit-invented path grammar).

On the read/interchange side, standard formats stay first-class:
`pathToAnchors` / `decomposePath` for friendly reads, `@weasel-js/svg`'s
`parseSvg` / `serializeSvg` for document round-trips.

**Why — and the paradox.** Adding a small path-language parser *reduces*
net implementation complexity rather than adding to it. Without it, every
consumer hand-assembles `polygonFromPoints([...])` (or worse) at each
call site; the friction is paid N times across the ecosystem and the
imperative code obscures intent. A terse declarative form pays the parser
cost once, in the kit, and lets scene composition read as data. *Let
consumers learn the typed-array form when they want its power — don't
make them learn even the builders just to drop one shape on the canvas.*

**Status.** `pathFromD(d)` ships from core (`packages/core/src/features/paths/pathFromD.ts`)
and accepts the full SVG `d` grammar (`M L H V C S Q T A Z`, absolute +
relative, smooth-curve reflection, arc→cubic), lowering it to the stored
`Path`. `@weasel-js/svg`'s document parser imports the same function, so the
`d` coverage is shared.

**Ratified rule: kit APIs speak `Path`; `pathFromD` is the only string
doorway.** Every path-bearing kit parameter takes the typed `Path`
(`PolygonPath | RectPath`) — `createSetPathOp`, the boolean ops,
`PathBuilder.fromPath`, `createPathLayer`, the hit-tests, the geometry slot
in a node's `data`. **Do not introduce a `string | Path` (`PathLike`) union
into those signatures.** A `d` string is converted exactly once, at the
boundary, via an explicit `pathFromD(d)` call; the resulting `Path` is what
flows through the kit.

Three reasons this is the settled choice, not a deferral:

1. **Preserves a property the surface already has.** The path-bearing
   surface is homogeneous on `Path` today — there are zero string-shaped
   path params. Accepting `d` inline would *introduce* polymorphism where
   none exists, not remove friction from it.
2. **It can't be made universal anyway.** The kit is generic over `TNode` /
   `TData` and does not own where geometry lives in a consumer's node. An
   inline-`d` convention could only intercept the kit's own typed slots, not
   `node.data` — so it would buy an inconsistent surface (strings work
   *here* but not *there*), which is worse than one uniform rule.
3. **Honest about cost.** `pathFromD` parses on each call. An explicit call
   at the boundary parses once and reuses the `Path`; a buried `string | Path`
   invites silent re-parsing in loops / re-inserts, and leaves `onWarn` with
   nowhere clean to go.

The terse-authoring win is fully delivered by `pathFromD` *existing* — a
consumer writes `pathFromD("M0 0 …")` instead of hand-assembling a builder.
That one call is the ergonomic, and it's enough.

**Scope.** Applies to public hooks, ops, and component props that ingest
or emit geometry. Internal kit code uses the typed-array form directly —
this rule governs the consumer boundary, not kit internals.

## Design tokens

`--wzl-*` tokens are generated. Edit `packages/theme/tokens/<theme>/*.json`
(DTCG) and run `npm run gen:tokens -w @weasel-js/theme`; never edit
`packages/theme/src/generated/`. A determinism test fails CI if the committed
output doesn't match what the generator produces from the source.

Token names are flat leaf keys inside `$type` groups — `color.fg-muted` becomes
`--wzl-fg-muted`. The type group carries `$type` and contributes nothing to the
name, because `--wzl-accent` and `--wzl-accent-base` are both real tokens and
DTCG forbids a token that is also a group.

Two things DTCG can't express are namespaced `$extensions`: alpha-over-alias
(`com.weasel.alpha`, which emits `color-mix()` in CSS and a computed `rgba()` in
JS) and modes (sibling token sets under `modes/`).
