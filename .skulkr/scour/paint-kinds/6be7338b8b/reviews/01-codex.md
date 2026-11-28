# Review saturation for `paint-kinds`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 13 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Registry lifecycle, mounted lazy consumers and built-in gradient seed behavior | 3 | 3 | 0 |
| 2 | Gradient conversion through built-ins, overrides and mesh stop adapters | 0 | 3 | 1 |
| 3 | SVG classification, tile geometry serialization and preview packing | 0 | 3 | 2 |
| 4 | Static and lazy mesh entry points, generated icon references and reset seams | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Removal subscribers can see mismatched editor and renderer registrations

[paintKinds.ts](packages/paint-kinds/src/paintKinds.ts#L152) · Pass 1 · P3 · Source-traced

Register a kind, subscribe to paintKindRegistry, then call its disposer. Inside the synchronous notification the editor entry has already been removed, but getPaintDrawKind still reports the disposed entry because dropDraw runs after notification. With an override, the same callback sees the restored editor entry paired with the outgoing draw implementation. Subscribers that rebuild from both views receive no subsequent editor notification once they match.

### 2. A mounted lookup can miss a kind whose loader is declared later

[paintKinds.ts](packages/paint-kinds/src/paintKinds.ts#L173) · Pass 1 · P3 · Source-traced

Mount usePaintKind for an unknown custom id and then declare its loader. Registering a loader updates the renderer loader registry only. The hook subscribes to paintKindRegistry and receives no event to re-read its snapshot and start the load. Without an unrelated render or an explicit lookup, the editor stays on the unknown-kind view and the loader never runs.

### 3. The gradient fallback chooses the wrong color at a duplicated start stop

[paintKinds.ts](packages/paint-kinds/src/paintKinds.ts#L98) · Pass 1 · P3 · Source-traced

Use two stops at offset zero, red followed by blue, and a third stop at offset one. sampleResolvedStops at zero returns blue under the last-stop-wins rule. The built-in colorOf returns red because firstStop keeps the first equal-offset entry. PaintInput can therefore seed a subsequent kind with red when the visible gradient starts blue.

Source and tests were left untouched.
