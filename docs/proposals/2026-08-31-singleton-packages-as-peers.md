# Singleton-bearing packages belong in `peerDependencies`

**Shipped.** `font` is a peer of `core`, `hud` and `text`; `core` is a peer of
`svg`, and the `d3` / `hud` / `ui` ranges are exact. What is left is the
`labkit` row in `docs/TODO.md`.

For whoever picks up weasel's packaging next. It assumes you know what a
module-global registry is and nothing else about this arc.

**The question this answers:** which weasel packages may be duplicated in a
consumer's `node_modules`, and which must not — and what to change so npm
enforces it instead of failing silently at runtime.

## The failure

`@weasel-js/font` keeps its registered faces in a module-global `Map` (`slots`,
in `outline/outlineRegistry.ts`), and its redraw signal in module-global
`subscribers` / `generation` (`glyphReady.ts`). Two physical copies of the
package are two registries. A consumer registers a face into one while
`layoutRuns` resolves against the other, every run resolves no metrics, and
the canvas is blank — historically with no diagnostic at all.

This is not hypothetical: a downstream project hit exactly it, and spent an
afternoon bisecting. `layoutRuns` now warns and names duplication as a cause
(`4180095a`), which makes the failure self-diagnosing. It does not make it
impossible.

Exact version pins are what produce the duplicate. Every package in the fixed
group pins its siblings exactly, so a consumer mixing two weasel releases —
an older `@weasel-js/ui` with a newer `@weasel-js/text`, say — leaves npm no
choice but to nest a second copy. A `peerDependency` turns that into an
`ERESOLVE` at install time. This is the React and three.js rule, for the same
reason.

## Which packages

The test is whether duplication changes *behavior* or only wastes memory.
A registry that consumer code writes into fails the test; a memo does not.

**Must be peers — they hold registries consumers write into:**

| package | state |
|---|---|
| `@weasel-js/font` | registered faces, outline slots, dynamic atlas, fallback policy, glyph-ready subscribers |
| `@weasel-js/core` | content handlers, paint kinds, shape painters, markers, program registry, svg/image handler seams |

**No change needed on their own account** — their only module state is caches
and warn-dedup, where a second copy costs memory and a repeated warning:
`@weasel-js/text` (layout memo, three warn flags), `@weasel-js/hud`. Both are
still exposed *through* font, which the rows above fix.

## What is already true

`core` is **already** a peer of `@weasel-js/d3`, `@weasel-js/hud` and
`@weasel-js/ui`. The convention exists; it is applied to three of six
dependents. Half this arc is finishing a decision the repo already made.

## The work

1. `@weasel-js/font` moves to `peerDependencies` in its three dependents:
   `core`, `hud`, `text`.
2. `@weasel-js/core` moves to `peerDependencies` in `svg` and `labkit`,
   matching `d3` / `hud` / `ui`.
3. Every package that peers a sibling also `devDependency`s it, or the
   workspace stops building — the same pairing `packages/geom/package.json`
   uses for `polygon-clipping`.
4. Regenerate `package-lock.json` and confirm the diff is confined to the
   manifests touched. A lockfile out of sync with a manifest is what broke
   `npm ci` on main on 2026-08-30.

Gate on `npm run test:smoke:consumer`. Its declaration audit is what actually
checks that packages declare what they import — `check:manifests` only
verifies that advertised export paths exist in the tarball.

## Decisions, as settled

- **Peer ranges are exact.** Changesets rewrites an exact peer range in the
  same pass that bumps the group, so a dependent never sees an out-of-range
  peer and no release escalates to a major on its account.
- **`labkit` keeps an ordinary dependency.** Its build inlines core, so it has
  nothing to resolve at the consumer and nothing to peer. It ships a second
  copy of core's registries as a result — the open row in `docs/TODO.md`.
- **No devDependency pairing.** npm links workspace siblings regardless; the
  three pre-existing peers build today without one.
- **The umbrella `weasel-js`** is private and unpublished, so its `core`
  dependency settles nothing until the package has a name that publishes.

## What this costs consumers

A peer dependency npm cannot satisfy automatically becomes an install-time
error rather than a silent nesting. That is the point, and it is a real break
for anyone currently installing a mixed set successfully by luck. Say so in
the changeset prose.
