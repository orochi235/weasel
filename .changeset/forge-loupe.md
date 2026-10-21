---
"@weasel-js/labkit": patch
"@weasel-js/forge": patch
"@weasel-js/paint": patch
"@weasel-js/svg": patch
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

Lenses in weaselforge. Alt+L opens the Loupe keymap, and `l` adds a lens: a bubble showing the patch
of a story under its reticle, magnified, or rendered with a comparison such as the opposite mode, an
arg or a DPR, as Swap, Split or Difference. A lens shows a Live second render or, from the dev
server, Pixels captured in headless Chromium; Playwright is a new optional peer of
`@weasel-js/forge`, and without it a lens offers Live only. Token, Contrast and pixel-grid readouts
sit in the lens chrome, and Alt+Slash opens a panel listing every key binding the workshop
registers.

Everything below is additive.

forge: the shell config takes `capture.allowOrigins`, naming what a capture page may load besides
the dev server, and `loupe.modeGlobal`, the global an opposite-mode comparison flips. A global
declaration may give `opposite(value, globals)`, the value that comparison flips it to.
`<TrialHost>` takes a `copy` prop, which makes the host a second copy of a trial's story, under
globals of its own. `@weasel-js/forge/shell` exports `followEdits`, and `@weasel-js/forge/frame`
exports `mountCapture`, which mounts a capture page.

labkit: the loupe entry gains `<LensOverlay>` (whose `renderReadouts` is handed `LensReadoutProps`),
`<LensActions>`, the lens scene and its ops, the `LensSource` contract, `createLoupeKeymap`,
`probeUnderLens` and `LENS_REST_MS`. A lab has an `overlay` chrome region, rendered over the trials
inside the lab surface, and `useLabEntries` reads the ambient entries installed on the lab, its
keymaps among them. Each lab surface gains a `'top'` canvas layer for one tenant above `'over'`,
made only while a tenant asks for it; a surface owner offers it by publishing `top` and `claimTop`
in its `SurfaceCanvases`. `surface.scope()` takes a list of elements as well as one
(`SurfaceScope`).

Elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; paint exports `contrastRatio`
and `wcagLevels`; svg exports `specificity`, `compareSpecificity` and `splitTopLevel`; an action's
`enabled` may return a reason as text (`ActionUnavailable` in routing, re-exported by core), which
the command palette shows as written.
