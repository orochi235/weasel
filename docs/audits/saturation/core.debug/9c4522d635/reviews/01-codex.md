# Review saturation for `core.debug`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 12 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Flags, URL parsing and override precedence | 0 | 0 | 1 |
| 2 | Hitbox inputs and overlay dispatch | 1 | 1 | 0 |
| 3 | Frame timing, per-layer counters and panel layout | 0 | 1 | 1 |
| 4 | Sink subscriptions, highlight updates and frame resets | 0 | 1 | 2 |
| 5 | Coordinate transforms, labels and viewport markers | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Debug overlay drops recorded path hitboxes

[createDebugOverlayLayer.ts](packages/core/src/debug/createDebugOverlayLayer.ts#L187) · Pass 2 · Low · Source-traced

Enable hitboxes and record a path hit shape through the public debug sink. The sink keeps the record, but the overlay only dispatches rectangles, circles and polygons. The path produces no debug command, so callers cannot inspect that supported hit shape.

Source and tests were left untouched.
