# Review saturation for `icons-plugin`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 12 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Virtual module placeholders and final chunk substitution | 1 | 1 | 0 |
| 2 | Table discovery, watch dependencies, and catalog refresh | 1 | 2 | 0 |
| 3 | Import recognition, lexical scopes, and call rewriting | 0 | 2 | 1 |
| 4 | Literal collection, parse recovery, and output annotation | 0 | 2 | 2 |
| 5 | Bundler hook compatibility, generated variant names, and test fixtures | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Chunk substitution also rewrites ordinary application literals

[index.ts](packages/icons-plugin/src/index.ts#L151) · Pass 1 · medium · Source-traced

App mode scans each entire emitted chunk for the placeholder spelling without establishing that a match comes from a plugin-generated virtual module. An ordinary logged string equal to the default marker is replaced with serialized icon data. A string matching an unknown variant marker can instead make the build fail at catalog lookup.

### 2. Production watch builds do not register icon table JSON as a dependency

[index.ts](packages/icons-plugin/src/index.ts#L189) · Pass 2 · medium · Source-traced

In production the transform records imported generators and package paths, and buildEnd reads their icon tables with filesystem calls. The only watcher registration is in the dev branch. When the catalog JSON changes without changing a module in the bundle graph, a Rollup watch build can leave the old glyphs in its output until a tracked file triggers a rebuild.

Source and tests were left untouched.
