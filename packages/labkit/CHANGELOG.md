# @weasel-js/labkit

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

## 0.1.0

### Minor Changes

- ec64b15: First public release of @weasel-js/labkit — React widgets for building self-contained interactive lab pages (primitives, controls, layers, drag-and-drop, property panels, undo, canvas helpers). Ships as a self-contained bundle with no `@weasel-js/*` runtime dependencies.
