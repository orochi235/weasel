# Review saturation for `labkit.config`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 28 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Auto resolver ordering, nested dependencies, and cycle detection | 1 | 1 | 0 |
| 2 | Report epochs across speculative renders | 1 | 2 | 0 |
| 3 | Schema resolution and prefs conversion | 0 | 2 | 1 |
| 4 | Number bounds, control builders, and heading placement | 0 | 2 | 2 |
| 5 | Section path translation and conditional row state | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Auto resolvers can read unresolved nested dependencies

[autoConfig.ts](packages/labkit/src/config/autoConfig.ts#L106) · Pass 1 · medium · Source-traced

The public auto builder says other auto paths are resolved when its callback reads them. The demand proxy only intercepts top-level keys, and removes nested auto values before beginning resolution. An earlier resolver reading c.grid.size can therefore get undefined if grid.size is auto and declared later, while moving the same dependency earlier makes it work. Nested dependency cycles also bypass the normal cycle check.

### 2. Abandoned renders can invalidate committed auto reports

[autoReports.ts](packages/labkit/src/config/autoReports.ts#L55) · Pass 2 · medium · Source-traced

The hook mutates the shared epoch ref during rendering. If a transition renders the hook with a path pinned and then suspends or is abandoned, the ref still reflects the speculative set. A subsequent committed render with the original auto path treats it as newly auto and invalidates the held report on the next recomputation, although the displayed configuration never pinned it.

Source and tests were left untouched.
