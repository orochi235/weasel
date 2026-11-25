# Review saturation for `apps.theme-editor.src`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 50 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Token inspection against inline cascade overrides | 1 | 1 | 0 |
| 2 | Asynchronous reload and active theme identity | 1 | 2 | 0 |
| 3 | Draft persistence, history limits and repair | 0 | 2 | 1 |
| 4 | Derived ramps, semantic aliases and export paths | 0 | 2 | 2 |
| 5 | Palette generation, preview controls and preferences history | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Token inspection reports stylesheet values overridden by inline declarations

[inspect.ts](apps/theme-editor/src/theme/inspect.ts#L74) · Pass 1 · Low · Source-traced

Inspect a component whose stylesheet sets a property from a theme token but whose inline style sets that same property directly. The inspector never reads inline declarations, so it reports the stylesheet token even though the declaration has lost the cascade.

### 2. Reloading one theme can remount a different theme's workbench

[ThemeEditor.tsx](apps/theme-editor/src/ThemeEditor.tsx#L106) · Pass 2 · Low · Source-traced

Start a reload of theme A and switch to B while the server request is pending. The completion increments a generation shared by every workbench key. B remounts as a result, losing local state such as its selected editor layer and preview options even though the reload requested A.

Source and tests were left untouched.
