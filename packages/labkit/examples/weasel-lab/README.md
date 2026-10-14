# weasel-lab

labkit's Lab/Trial chrome around a weasel scene, through `useTrialScene` and
`<TrialSceneCanvas>` — the pattern the package README's "A weasel scene in a
trial" section describes.

## Run

```bash
npm run dev:weasel
```

## What it shows

- The instrument declares no `canvas`, so the scene owns every gesture over the
  trial, and `undo: {}`, so the trial's Undo and Redo step the scene's own
  history.
- `Show grid` and `Grid spacing` reach the grid layer and the move action's
  snap strategy on the next render.
- `useTrialScene` writes each recorded edit into the trial's state, and the lab
  is stored under `storageKey`, so the drawing survives a reload and Reset and
  Clone carry it.
- `LABKIT_EXAMPLE=weasel-lab` switches `vite.config.ts` to an alias set that
  replicates weasel's monorepo aliases.
