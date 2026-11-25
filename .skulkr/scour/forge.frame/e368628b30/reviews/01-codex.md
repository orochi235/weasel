# Review saturation for `forge.frame`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 34 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Frame loading and synchronous importer failures before handshake | 1 | 1 | 0 |
| 2 | Frame session recovery and schema answer publication | 1 | 2 | 0 |
| 3 | CSS variable use in nested rules and ancestor scopes | 1 | 3 | 0 |
| 4 | Capture preparation, keyed renders, and paint readiness | 0 | 3 | 1 |
| 5 | Accessibility audits, highlight coordinates, and scroll synchronization | 0 | 3 | 2 |
| 6 | Index preview state, viewport fitting, and frame service cleanup | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A synchronous preload failure prevents the frame from opening its channel

[mountFrame.tsx](packages/forge/src/frame/mountFrame.tsx#L80) · Pass 1 · Medium · Source-traced

The eager hash-based preload calls the importer before installing the handoff listener or entering the import fault handler. An importer that throws before returning its promise bypasses the attached catch, so mountFrame rejects without saying hello or reporting the import error to the parent. The parent's waiting frame never receives that fault.

### 2. A transient schema answer failure marks the config as answered

[storySession.tsx](packages/forge/src/frame/storySession.tsx#L90) · Pass 2 · Medium · Source-traced

The session updates answeredKey before evaluating answerSchema and sending its result. A predicate that throws once causes the current input to report a render fault. A later input with the same config, such as a globals change that retries the render, skips answers even if the predicate can now run. The shell can remain without fresh visibility, validation, or enablement information until the config changes.

### 3. The CSS variable usage scan misses nested declarations aimed inside a story

[cssVarUse.ts](packages/forge/src/frame/cssVarUse.ts#L62) · Pass 3 · Low · Source-traced

The style-rule branch scans the entire serialized block under the outer selector's reach and never visits its nested rules. If the outer selector matches only an ancestor of the story but its nested selector targets a descendant of the story, the nested declarations' var() references supply no usage seeds. The variables can appear in the full inventory but be omitted by the story's used-variable filter.

Source and tests were left untouched.
