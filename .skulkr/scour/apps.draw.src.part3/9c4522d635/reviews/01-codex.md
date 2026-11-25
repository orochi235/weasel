# Review saturation for `apps.draw.src.part3`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 37 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Initial paint options and the explicit none sentinel | 1 | 1 | 0 |
| 2 | Camera compensation under scaled layout | 1 | 2 | 0 |
| 3 | Text edit cleanup and journal settlement | 0 | 2 | 1 |
| 4 | SVG metadata, note frames and page records | 0 | 2 | 2 |
| 5 | Session save, tool reflection and panel commands | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Explicitly empty initial paint is replaced by the default paint

[ColorContextProvider.tsx](apps/draw/src/tools/colorContext/ColorContextProvider.tsx#L104) · Pass 1 · Low · Source-traced

Mount the provider with a fresh tool-value store and initialFill set to null. ActivePaint defines null as no paint, but the fallback uses nullish coalescing and replaces it with white. The same applies to initialStroke.

### 2. Changing toolbar rows pans by too much inside a scaled host

[useHoldContentUnderChrome.ts](apps/draw/src/useHoldContentUnderChrome.ts#L26) · Pass 2 · Low · Source-traced

Embed Draw under a 2× ancestor transform and open a row of options that adds 20 layout pixels. The DOM rect reports a 40-client-pixel change. The hook divides by camera zoom but omits the ancestor's scale, so the camera shifts twice as far as required and content visibly jumps.

Source and tests were left untouched.
