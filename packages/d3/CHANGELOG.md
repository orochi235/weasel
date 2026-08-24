# @weasel-js/d3

## 1.2.0

## 1.1.0

### Patch Changes

- f85a9dd: `selection.interrupt()` now stops custom tweens, not just the pose tween

  `animator.cancelKey` matches a key exactly. Pose tweens are keyed
  `d3-transition:<name>:<id>` and custom `.tween()` declarations add a
  `:<tweenName>` suffix, so the selection-level `interrupt(name)` — which built
  the pose key and cancelled that alone — never reached them. A transition
  carrying a custom tween kept applying values after it was interrupted. The
  live custom keys are now tracked as they spawn and drained when interrupted.

  The existing coverage asserted the namespace claim using a transition that
  had only a pose tween, which is why it passed.

## 1.0.4

## 1.0.3

### Patch Changes

- 514c34a: Document every public export at its definition site

  A JSDoc string now sits on each symbol reachable through a package's published
  entry points, in every package except `@weasel-js/ui`. Documentation only — no
  export was added, removed, renamed or reordered, and no behavior changed.

  `npm run audit:jsdoc` enumerates the public exports and reports which lack a
  docstring, so the claim can be re-derived rather than trusted.

## 1.0.2

## 1.0.1

## 1.0.0

## 0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

## 0.7.1

## 0.7.0

## 0.6.0

## 0.5.1

## 0.5.0
