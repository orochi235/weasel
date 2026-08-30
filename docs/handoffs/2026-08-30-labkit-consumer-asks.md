# labkit: what other projects have asked for

For whoever picks up labkit work next. It answers one question — which labkit
changes do consuming projects actually want — and records the evidence so the
survey does not have to be redone. Nothing here is started.

Replaces `2026-08-28-labkit-fixes-klieg-waits-on.md`, which described the zoom
clamp as unpushed on a worktree. It merged (`8bed4819`) and is on `origin/main`.

Branch `labkit/consumer-asks`, worktree `.claude/worktrees/labkit-asks`, deps
installed, no commits on it yet.

## Delivered by a release, not by code

klieg is pinned to labkit **1.1.0** while **1.2.0** is published, so it is
missing `useTiledSurface`, `useOrbit`, the opaque trial view and the `job`
capability — features built for klieg and precioussss in the first place. Its
caret already admits them; what pins it is klieg's lockfile. `npm update
@weasel-js/labkit` in `~/src/klieg`.

klieg also deferred `FloatingPanel` and `Legend` upstream because 1.2.0 shipped
without them, and grew `LegendPanel.tsx` with a locally-declared `LegendEntry`
instead. Both exist on `main` now. When they ship, that local copy comes out —
`klieg/docs/superpowers/plans/2026-08-23-corner-lab-legend.md` says to reopen
only if labkit ever ships `FloatingPanel`.

## Asked for by two projects

**Config-field vocabulary** — the tuning-rail spec, wanted by klieg's tube lab
and precioussss's gem bench:

- `commit: 'end'` on sliders. klieg bypasses `SliderRow` for weasel-ui's
  `Slider` entirely to get it; `precioussss/apps/lab/src/gemBench.tsx:50` has a
  comment claiming behaviour that does not exist.
- Hover hints. **Nearly free:** `Annotations.description` already exists in
  `config/types.ts` and weasel-ui's `PrefsForm` renders it as a tooltip.
  labkit's own `ControlPanel` never passes it through.
- Snap-to-stops, lens binding, inert-with-a-reason, computed bounds — filed in
  `packages/labkit/docs/IDEAS.md`.
- Nested paths. `ResolvedConfig.group` is documented flat, so sherpa cannot
  declare `fire.hold` and it stays uneditable (`sherpa/TODO.md:96`). Already
  `docs/TODO.md:1377`; sherpa is the second asker.

**An instrument can request a view** — four reports, one piece of work.
`initialView` is static per instrument (klieg's `subject: 'letter'` reframes and
cannot re-zoom from 1600x); its `pan` is a screen offset an instrument cannot
know; it hangs off the `canvas` capability, so a foreign-renderer instrument
cannot declare one at all; and the trial status bar still asserts a zoom for a
view that has none.

**List controls.** sherpa needs a recursive tree — `LayerList` is flat, so it
hand-rolled `StepTree.tsx`. wod cannot use `LayerStack` because `kind`,
`paletteKinds` and `onAdd` are required and its segments have no kind
(`wod/docs/superpowers/specs/2026-07-30-wod-editor-design.md:229`). wod also
wants a multi-control grid row and a multi-select row.

## Small and unambiguous

- `@weasel-js/labkit/dragdrop` is a public subpath exporting **three types and
  no runtime**. `DragDropRuntime`, `Palette` and `DragGhost` exist in source,
  unexported. sherpa withdrew its ask on finding `useReorderDragList` in
  `@weasel-js/ui`, but a subpath with no runtime is still a defect.
- `Workspace`'s `layout` type is not exported; klieg reads it off
  `ComponentProps<typeof Workspace>` (`tube-lab/src/persist.ts:7`).
- `lk-property-list__span` is a private class name wod types by hand for a
  full-width child. It wants to be a prop.
- `FloatingPanel` is pointer-only — no keyboard move (`windease/TODO.md:349`).
- labkit's stylesheet assumes the host supplies a dark ground. sherpa rendered
  white-on-white through 361 passing tests before anyone saw it.

## Follow-up this session created

`changeset version` computes **2.0.0-pre.0**, not 1.3.0-pre.0, because `d3`,
`hud` and `ui` peer-depend on `@weasel-js/core` and changesets promotes a peer
dependent past the bump its own changesets asked for; the `fixed` group then
moves all sixteen. `6b87ddd9` sets the number by hand rather than fixing that,
so the next release repeats it. `onlyUpdatePeerDependentsWhenOutOfRange` is
already true and did not prevent it.

## Traps

**A test file that passes alone and fails in a full run is measuring uptime,
not your change.** `SceneCanvas.animatedZoom.test.tsx` did this, and bisecting
it with the single file in isolation at one end and the full suite at the other
produced a clean, entirely false "both parents green, merge red". Use one probe
across the whole range. Fixed in `useAnimator.ts` — jsdom gives `rAF` and
`performance.now()` origins ~600ms apart.

**npm's web auth needs a TTY.** Neither the Bash tool nor a `!`-prefixed
command is one, so `npm login` and a 2FA `npm publish` print their URL and exit
non-zero. A real terminal window is the only path. On a passkey account there
is no OTP code to fall back to.

**A registry `GET` can 404 for minutes after a `PUT 200`.** Publishes that had
already succeeded looked like they had never run. Check the npm debug log's
`http fetch PUT` line before concluding anything.
