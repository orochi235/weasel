# Review saturation for `labkit.trial.part1`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 27 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Dock and undock component identity | 1 | 1 | 0 |
| 2 | Live undo ordering across mark and instrument histories | 1 | 2 | 0 |
| 3 | Trial creation, cloning, reset, and camera placement | 0 | 2 | 1 |
| 4 | Settings edit records, history providers, and state writes | 0 | 2 | 2 |
| 5 | Trial chrome, context boundaries, and layer controls | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Undocking remounts the sidebar body and loses its local state

[TrialChrome.tsx](packages/labkit/src/trial/TrialChrome.tsx#L200) · Pass 1 · medium · Source-traced

The docked section renders its body under SidebarRegion. On undock that branch removes it, and a separate Portalled component renders the body through createPortal once the workspace host exists. React treats these as distinct subtrees, so local component state is lost, contrary to the UndockedSections contract that only the DOM moves. Docking again takes the reverse remount path.

### 2. Undo dispatch uses a stale snapshot of annotation availability

[trialUndo.ts](packages/labkit/src/trial/trialUndo.ts#L77) · Pass 2 · medium · Source-traced

marksFirst uses marks.moves from render, while it queries the other history live. If an annotation is added after those bindings were created and undo is invoked before the next render, the captured false skips annotation undo entirely. With an earlier instrument edit available, it undoes that edit even though the mark is newer. The annotation store exposes live canUndo and canRedo methods that the dispatcher does not consult.

Source and tests were left untouched.
