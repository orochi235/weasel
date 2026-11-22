Read-only stops removal (A): fixed 3a03f7fe78

Held overlay reports `onInput`/`onCancel` on an Escaped drag (A+B): fixed bdbe035409

Selection moves before a declined removal commits (A+B): fixed 3dde402b8f

Arrow key mid-drag overwrites the drag's start, so Escape can't restore it (B): fixed 1fcadb6a4f

`onSelectionChange` not fired when the selected stop at index 0 is removed (B): fixed c130386f8b

No extra defects. The kind and blend-space switches already refuse under `ReadOnly`. I added a test for that alongside the read-only fix, and it passed before the fix too.

Checks:
- `npx vitest run --maxWorkers=1` on `GradientStops.test.tsx`: pass (31). `GradientHandles.test.tsx`: pass (26). `GradientHandles.hold.test.tsx`: pass (5). `GradientEditor.test.tsx`: pass (17). `MeshHandles.test.tsx`: pass (7). `MeshHandles.hold.test.tsx`: pass (5). `MeshEditor.test.tsx`: pass (6).
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed on 4 changeset titles over 140 characters; I fixed those in their own commits.
- `npm run check:changesets`: pass.
- `npm run lint -w packages/ui`: fail, because `@weasel-js/ui` has no `lint` script ("Missing script: \"lint\""). In its place I ran eslint on `packages/ui/src/components/GradientEditor`: pass.

tally: 7 of 7 fixed, 0 extra fixed