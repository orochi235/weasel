---
'@weasel-js/labkit': patch
---

An instrument can declare regions that accept marks.

`annotations: { targets, meaning? }` on an `Instrument` names the regions and,
optionally, the vocabulary a mark's status may use. `createAnnotationStore`
answers everything about the marks on those regions — `query`, `hitTest`,
`within`, `isStale` — over a weasel scene it treats as the truth rather than a
copy it keeps in step.

Positions cross the store boundary as fractions of a target's content box, so a
mark stays on the same feature when the render resolution changes.
`positionDependsOn` names the config keys a target's positions depend on;
labkit snapshots them beside each mark and compares them later without knowing
what any of them mean.

Snapshots from `toJSON()` are JSON-safe and carry their own version, because
labkit stringifies `record.state` raw and its document migrations never reach
into a trial's state.

The overlay that renders marks and the tools that draw them are not in this
release: the store is reachable and testable on its own.
