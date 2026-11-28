# Review saturation for `hud`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 24 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Pointer press bookkeeping and release capture | 1 | 1 | 0 |
| 2 | React ref lifetimes and retained rendering dependencies | 2 | 3 | 0 |
| 3 | DOM accessibility ownership and captured drag lifetimes | 2 | 5 | 0 |
| 4 | Attachment teardown, hit fallthrough, and frame subscriptions | 0 | 5 | 1 |
| 5 | Glyph transforms, shadows, text measurement, and atlas registration | 0 | 5 | 2 |
| 6 | Widget capabilities, action parameter contracts, and fixture boundaries | 0 | 5 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An unrelated release cancels pending HUD presses

[openPresses.ts](packages/hud/src/openPresses.ts#L30) · Pass 1 · medium · Source-traced

The window callback ignores the event and snapshots every open press. A second pointer releasing or being canceled while a widget is still held can cancel the held widget's press. With a single contribution reused across canvases, the same unfiltered sweep also applies to presses on other canvases.

### 2. Switching React ref objects leaves the HUD on the old canvas

[useHud.ts](packages/hud/src/react/useHud.ts#L37) · Pass 2 · medium · Source-traced

The attach effect reads the canvasRef object but omits it from the dependency list. A render that explicitly supplies a different populated ref while the theme and font are stable leaves the old attachment in place. Switching from an omitted ref to a populated ref also does not start the effect.

### 3. Layer and widget caches give dependency functions different focus contexts

[attach.ts](packages/hud/src/attach.ts#L110) · Pass 2 · low · Source-traced

The outer retained-layer cache invokes widget deps with an attachment context that never sets focusVisible. The actual draw cache supplies hud.focusVisible. A widget whose dependencies change only when the ring is visible can request a redraw while the outer layer reports unchanged, leaving the old commands on screen until some other dependency invalidates the layer.

### 4. The accessibility mirror erases existing canvas ARIA relationships

[accessibleMirror.ts](packages/hud/src/accessibleMirror.ts#L70) · Pass 3 · medium · Source-traced

The initial follow calls clear even with no mirror or accessible widget. It removes preexisting aria-owns and aria-activedescendant from the supplied element. When a tree is eventually mirrored and then cleared, the original host values are also lost.

### 5. Captured drags keep dispatching after their widget is removed

[tool.ts](packages/hud/src/tool.ts#L109) · Pass 3 · medium · Source-traced

The drag captures the widget at start, then invokes its handler on later moves and end without checking disposal or HUD membership. Removing the widget mid-drag can reach its disposed handler on the next move or release. The open-press sweep already checks membership and disposal before delivering cancellation.

Source and tests were left untouched.
