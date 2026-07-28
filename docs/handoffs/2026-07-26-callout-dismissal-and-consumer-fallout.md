# Handoff: what `core-to-packages` did downstream

## Status (trimmed 2026-07-27)

This document originally covered three things. Two are now closed and have
been cut:

- **Callout `onDismiss`** (`a52faaa1`, shipped in `@weasel-js/core@0.5.0`) —
  cut because the two gotchas that made it worth writing down now live in
  `packages/ui/src/components/Callout/Callout.tsx` as comments at the exact
  lines they constrain: RAC's `Dialog` runs props through `filterDOMProps`
  and silently drops handlers it doesn't recognize (so Escape cannot ride on
  a React `onKeyDown` — hence the listener on the section via `dialogRef`),
  and RAC never recomputes position when `anchorRect` is merely *translated*
  (hence the synthetic `window` resize). `Callout.test.tsx` is the contract.
  Source beats a handoff for both.
- **`@weasel-js/ui` had no subpath exports** — resolved. `packages/ui/package.json`
  at 0.6.0 publishes `./components/*`. Together with 0.5.1 shipping the
  `.d.ts` files it advertised, both prerequisites for lbx-editor moving off
  `file:../weasel` are met.

What remains is the part with no other home: how a real consumer is wired to
this repo, and how the packaging move broke it silently.

---

## 1. What the packaging move broke downstream

When `@weasel-js/core` moved into `packages/core/`, lbx-editor broke in two
places at once. Neither was obvious, and **the app itself kept working** —
vite builds its aliases by reading the package layout, so `npm run dev` was
fine while everything else was not.

| Surface | Why it broke |
|---|---|
| `tsconfig.json` | paths hardcoded `../weasel/src/*`; tsc lost every `@weasel-js/core` import |
| `vitest.config.ts` | had **no aliases at all** — tests resolved core through `node_modules`, which worked only while weasel's repo root *was* that package. After the move the linked root has no entry: `Failed to resolve entry for package "@weasel-js/core"` in 3 test files |

Fixed consumer-side in lbx-editor `4d995f2`: the test config now calls
`weaselAliases()` outright, and the tsconfig paths point at `packages/core/src`.

**The lesson for weasel:** consumers replicate `scripts/vite-aliases.ts` by hand
in their `tsconfig.json` paths, because tsc can't run the script. There is no
mechanism by which they find out the layout moved — they discover it as a
resolution error in whichever surface they happen to run next. If the layout
moves again, either generate the tsconfig paths from the same script or say so
loudly in the release notes.

---

## 2. How lbx-editor consumes weasel

Worth knowing before judging whether a change is breaking.

- `package.json`: `"@weasel-js/core": "file:../weasel"`
- `vite.config.ts` **and** `vitest.config.ts`: `weaselAliases(resolve(__dirname, '../weasel'), [...])`
- `tsconfig.json`: paths mirroring that alias list by hand
- CI (`.github/workflows/deploy.yml`) checks out `orochi235/weasel` into `./weasel`
  and runs `npm run build`, which is **`tsc --noEmit && vite build`** — so a weasel
  type error fails the editor's deploy, not just its local typecheck.

APIs in use: `SceneCanvas`, `useScene`, `useSelection`, `renderSceneToPixels`,
the scene `postProcess` hook, `textCommand` (MSDF text), the kit `imageCache`,
`defineTool`, plus four `@weasel-js/ui` components (`ToolPalette`, `Prefs`,
`Callout`, `Toast`).

Those four are imported by **subpath, deliberately** — the reason is recorded at
lbx-editor `App.tsx:28`: importing the barrel drags in sibling components like
DataGrid, which trips a duplicate `@types/react` mismatch against that app's
newer React types.
