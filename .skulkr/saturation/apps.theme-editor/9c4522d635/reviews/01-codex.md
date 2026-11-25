# Review saturation for `apps.theme-editor`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 5 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Palette parser numeric validation | 1 | 1 | 0 |
| 2 | Generated file consistency on write failures | 1 | 2 | 0 |
| 3 | Copic ordering, required fields and type declarations | 0 | 2 | 1 |
| 4 | Vite app paths, cache and release output | 0 | 2 | 2 |
| 5 | Icon ownership and generator entry points | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. LEGO RGB parsing can emit invalid hex colors

[brand-colors.mjs](apps/theme-editor/scripts/brand-colors.mjs#L69) · Pass 1 · Low · Source-traced

Feed a solid sample with RGB channel values (999, 40, 80). A read-only parser probe produced #3e72850, a seven-digit value. The parser checks that the fields are digits but does not validate their range before generating the palette.

### 2. A write failure can leave the generated palettes from different runs

[gen-brand-colors.mjs](apps/theme-editor/scripts/gen-brand-colors.mjs#L35) · Pass 2 · Low · Source-traced

Make the LEGO output writable while the Copic output cannot be written. The first write replaces its table before the second throws, leaving the outputs at different revisions despite the script's stated failure behavior.

Source and tests were left untouched.
