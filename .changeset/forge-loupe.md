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
registers. The shell config's new `capture.allowOrigins` names what a capture page may load besides
the dev server.

labkit's loupe entry gains `<LensOverlay>`, `<LensActions>`, the lens scene, the `LensSource`
contract and `createLoupeKeymap`. Each lab surface gains a `'top'` canvas layer, for one tenant
above `'over'`.

Additive elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; core re-exports
`moveSources`; paint exports `contrastRatio` and `wcagLevels`; svg exports `specificity`,
`compareSpecificity` and `splitTopLevel`; an action's `enabled` may return a reason as text, which
the command palette shows as written.
