# Review saturation for `apps.draw`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 16 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Source symbol indexing and multiline aliases | 1 | 1 | 0 |
| 2 | Callback AST rewriting and sourcemap offsets | 0 | 1 | 1 |
| 3 | Trait extraction, virtual updates and source scopes | 0 | 1 | 2 |
| 4 | Draw build, E2E server configuration and icon registration | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The source index misses aliases exported across multiple lines

[exportInfo.ts](apps/draw/vite-plugin-source-index/exportInfo.ts#L48) · Pass 1 · Low · Source-traced

In a module with a multiline export list containing foo as exposed, the Bundle Inspector cannot look up exposed. The index matches complete brace lists within individual lines. A read-only probe of indexExports with this shape yielded only foo from its declaration.

Source and tests were left untouched.
