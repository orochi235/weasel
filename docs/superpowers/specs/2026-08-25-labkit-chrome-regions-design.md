# labkit chrome regions — design

**What this is:** arc 3 of the labkit presentation pass. It defines how a trial's chrome is
assembled: what an instrument declares, where those declarations land, and how a consumer
changes the result.

**Who it's for:** whoever implements it. Assumes labkit's trial/instrument runtime — an
`Instrument` declares config and optional capabilities, a `Trial` renders one, `TrialChrome`
frames it.

**What question it answers:** the spec this continues
(`2026-08-24-labkit-presentation-design.md`) says a lab that wants a tool palette or a real
sidebar "has nothing to reach for", and that both should be engine surface — "a trial declares
what it has, the chrome lays it out." This says what that mechanism is.

---

## The problem is not a missing feature

labkit has three mechanisms for routing a declaration to chrome, and they do not add up to one.

| Mechanism | State |
|---|---|
| `detectCapabilities()` → `CapabilityFlags` | exported, unit-tested, never called by the runtime |
| `toolbar` / `sidebar` / `statusBar` on `TrialChromeProps` | declared and exported, but `Trial` never passes them and `LabProps` has no way to — a consumer of `<Lab>` cannot replace any chrome region |
| `sidebarExtras: ReactNode` | live, and how the drag palette and layer list actually reach the sidebar — appended, not laid out |

What the runtime really does is check capability presence inline: `instrument.canvas != null`
appears at six sites, `hasUndo` and `hasCanvas` are hand-copied onto the toolbar context, and
`DefaultToolbar` gates two groups on those two booleans. That is the right idea expressed as
scattered null checks. Arc 3 makes it one mechanism and deletes the other three.

## Regions

A **region** is a named position in a trial's chrome. There are six, plus two on the lab:

| Region | Holds | Status |
|---|---|---|
| `title` | trial name, drag grip | exists |
| `toolbar` | actions on the trial | exists |
| `sidebar` | panels, in sections | exists, unsectioned |
| `status` | readouts | exists |
| `palette` | the tool strip | new |
| `viewport` | actions on the *view* of the trial | new |
| lab `header` | add-trial, mode | exists |
| lab `palette` | the lab's tool strip | new |

`viewport` is a distinct region from `toolbar` because they act on different things: the
toolbar clones and closes a trial, pan/zoom/fit change the view of it. Zoom sits in the
toolbar today because that is where it landed. `ScaleIndicator` follows it there; `FpsMeter`
does too, being a readout about the view rather than about the trial.

Content is not a region. It is the instrument.

**Do not call a region a slot.** `slot` already means a holder for one engaged tool
(`ToolsApi.active` is "the active-slot tool id"), and arc 3 adds two more of those — see
*The tool slot*. `ToolbarSlot`, `SidebarSlot` and `StatusBarSlot` are retired.

## Contributions

A contribution is data the chrome renders, keyed to a region:

```ts
{ id: 'undo', region: 'toolbar', group: 'history',
  item: { icon: UndoIcon, label: 'Undo', shortcut: 'Mod+Z',
          disabled: !canUndo, onActivate: undo } }
```

The type is a union discriminated on `region`, so a sidebar section cannot be typed as a
toolbar button:

```ts
type TrialContribution =
  | { region: 'toolbar';  item: ToolbarItem }
  | { region: 'palette';  item: ToolItem }
  | { region: 'sidebar';  item: SidebarSection }
  | { region: 'viewport'; item: ViewportControl }
  | { region: 'status';   item: StatusReadout }
```

A contribution may supply `render: (ctx) => ReactNode` instead of `item`, and opt out of the
chrome's layout. That escape is deliberate and it is visible in the declaration — the point of
declaring items as data is that the chrome owns presentation, so the density and type-scale
pass that follows this arc has one place to change rather than every contributor's markup.

### Where they come from

Built-in, derived from what the instrument declares:

| Declaration | Region | Contributes |
|---|---|---|
| `undo` | toolbar · `history` | undo, redo |
| `canvas` | viewport, status | zoom, fit, actual-size; zoom readout, scale bar |
| `layers` | sidebar | a *Layers* section |
| `dragDrop` | sidebar | its source-list section |
| `job` | status | `JobProgress` |
| `configSchema()` | sidebar | a *Settings* section |
| `tools` | palette | the tool strip |
| *always* | toolbar · `trial` | clone, reset, close, snapshot |

`dragDrop`'s palette goes to the **sidebar**, not the `palette` region. It is a source list you
drag *from*; the `palette` region is a tool strip you select *in*. The shared word is the only
thing they have in common.

An instrument adds its own through `Instrument.chrome?: TrialContribution[]`, and a consumer
adds through `<Lab chrome>`.

### Assembly

Bundles concatenate in order: built-ins, then the instrument's, then the consumer's.
**A duplicate id throws**, following core's `mergeContributions` — a contribution silently
losing to a later one is the failure a registry exists to prevent.

So a consumer removes a built-in by naming it, and adds a replacement under its own id:

```tsx
<Lab suppress={['snapshot']} chrome={[myExportControl]} />
```

Two steps, and they read differently, which is the point: the thing that replaced snapshot is
greppable as not-snapshot. There is no whole-region override — dropping one button should not
require rebuilding the bar.

`suppress` naming an id that does not exist throws too. A typo that silently suppresses
nothing is the same class of bug as a duplicate id winning silently.

## The tool slot

labkit has no notion of a tool: no registry, no active tool, no trial or lab state for one.
Core has a complete tool system, and it is not reusable here — `ToolsApi` carries
`hotkeyEngaged`, `ambient`, eligibility tiers and `getActiveOverlays(): RenderLayer[]`, all
bound to the gesture dispatcher and the scene graph. A labkit instrument is an arbitrary
canvas or DOM tree. Requiring it to supply a `ToolsApi` would require it to be a weasel scene.
`@weasel-js/ui`'s `ToolPalette` takes a `ToolsApi` and is therefore not usable as-is either;
labkit's palette region renders `ToolGroup` and `ToolButton`, which are controlled and carry no
such dependency.

So labkit declares its own, at two levels:

- `LabStoreState.activeToolId: string | null` — the lab's slot.
- `TrialRecord.activeToolId?: string | null` — the trial's, optional.

A trial resolves `activeToolId ?? lab.activeToolId`, and the instrument reads the resolved
value off `RenderContext`.

**Which slot a trial uses follows from where its tools were declared, not from a runtime
detach.** An instrument declaring `tools` gets its own palette region and writes its own slot.
An instrument declaring none renders no trial palette and reads the lab's. Most instruments
will declare none, so most trials fall back — which is why the trial's slot is optional rather
than seeded.

The trial slot is part of `TrialRecord`, so it persists, restores and clones with everything
else the trial carries.

## What this deletes

- `detectCapabilities()` and `CapabilityFlags` — the derivation replaces them. They do not
  gain a caller; they go.
- `ToolbarSlot`, `SidebarSlot`, `StatusBarSlot` and the `toolbar`/`sidebar`/`statusBar` props
  on `TrialChromeProps`.
- `sidebarExtras`.
- The six inline `instrument.canvas != null` checks, and `hasUndo`/`hasCanvas` on
  `TrialToolbarContext`.

`DefaultToolbar`, `DefaultSidebar` and `DefaultStatusBar` stop being components a slot might
replace and become the built-in contribution bundle.

## Out of scope

**The density, spacing and type-scale pass** is the arc after this one. It has its own
inventory: 128 `font-size` declarations across labkit and `@weasel-js/ui` with 13% tokenized,
15 distinct sizes between 9px and 18px, six radii for one card family, three conventions for
monospace, and raw `font-weight: 600` against a token set that resolves to 300/500/700. Doing
it before the regions settle means doing it twice.

**The tuning rail** (`hint` / `commit` / `inert` / `bounds` on `ConfigFieldBase`, and lens
binding) is specified separately in
`packages/labkit/docs/superpowers/specs/2026-08-22-tuning-rail-design.md`. It changes what a
config field declares; this arc changes only where the resulting section sits. They do not
collide.

**`registerSerializers` having no callers** is a live bug (`docs/TODO.md`, P2) in the same
runtime. It is not a chrome problem.
