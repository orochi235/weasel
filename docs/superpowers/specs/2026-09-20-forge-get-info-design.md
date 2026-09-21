# Get Info

For whoever builds or reviews this. weaselforge can show you a story but it
cannot tell you anything *about* one — where its file is, what its props mean,
what the author wrote above it. This adds Finder's Get Info: one palette
button, one dialog, a fixed dossier.

## The dossier

Three sections, identical for every story, in this order.

**Identity** — the story's title, export name, and id; the component it sits
under; the library it ships in; and the absolute path of its file. Everything
here is already in `IndexEntry`, plus `libraryOf(entry)`.

**Args** — one row per config leaf: the prop's name, its control kind, its
default, the focused trial's current value, and the description its `argType`
carries. `ready.schema` already ships kind, default, `annotations.name` and
`annotations.description` to the shell; `TrialRecord.config` holds the live
values. The table carries `tabular-nums`; the value and default columns stay
start-aligned, since a column holding `clicks` beside `1` is not a column of
numbers.

**Docs** — the JSDoc written above the story's export, and the one above the
file's meta. New; see below.

No tags. forge's CSF surface has no `tags` field, and inventing one to give the
dossier a row to print is the wrong order to do that in.

## Where it lives

`packages/forge/src/shell/info/`:

- `dossier.ts` — `storyDossier({ entry, instrument, config, ready })` assembles
  the plain object above. No React, no lab context; it is the whole of the
  logic and it is a pure function of its inputs.
- `StoryDossier.tsx` — renders a `Dossier`. Presentation only: no lab context,
  no dialog, no open state. The modal is one host for it and a
  `region: 'aside'` `SidebarSection` would be another, with nothing to change
  here when that happens.
- `StoryInfoDialog.tsx` — reads `focusedTrialId` from `useLabContext()`,
  resolves `index.find((e) => e.id === record.instrumentName)`, and renders
  `<Dialog>` around `<StoryDossier>`. Mounts as a child of `<Lab>` in
  `Workshop`, beside `RouteOpener` and `LabGlobals`, which is where forge
  already puts components that need lab context but no region.

An instrument exists — with an empty schema — before its story's frame has
reported anything, so "not loaded yet" and "takes no args" look identical from
the schema alone. `useStoryRegistry` grows an `isReady(id)` for the difference,
and the dossier prints *Open this story to read its args* rather than claiming
the story has none.

`Workshop` holds the open state and contributes the palette item.

## Palette actions

`ToolItem` describes a mode: `PaletteRegion` renders every item as a
`ToolButton` whose click writes `ctx.setActiveTool(id)` and whose `active`
reflects `activeToolId`. Get Info is a command, so the rail cannot hold it.

`ToolItem` gains an optional `onActivate`:

```ts
export interface ToolItem<TCtx = TrialChromeContext> {
  icon: IconComponent;
  label: string;
  shortcut?: string;
  disabled?: boolean;
  /** Runs on press instead of selecting. An item with one is a command: it
   *  never latches, and never reads the tool slot. */
  onActivate?: (ctx: TCtx) => void;
}
```

`PaletteRegion` branches on it — `onActivate(ctx)` instead of
`setActiveTool(c.id)`, and `active={false}` so the button does not report a
pressed state it does not have. Both contribution unions (`labTypes.ts:43` for
the lab, `types.ts:90` for a trial) take the generic; the default parameter
leaves every existing call site alone.

This is the labkit half of the change and it stands on its own: a tool rail
that can only hold modes is missing half of what rails do.

`shortcut` is a tooltip hint — nothing in labkit binds keys. `Workshop` binds
`⌘I` itself, on `window`, ignoring the event when focus is in a text field.

The lab's rail and the focused trial's share one strip, so Info lands under
the story's own tools — Interact, Select, Freehand and the rest — rather than
in a rail of its own.

## JSDoc at index time

`indexFile.ts` already parses every story file with `@babel/parser` and keeps
only titles and export names. It grows three more harvests off the same AST:

- the leading block comment on the default export → the component's blurb,
- the leading block comment on each story export → that story's blurb,
- the `component:` property's identifier name in the meta object.

`IndexEntry` gains `description?`, `componentDescription?` and
`componentName?`, all optional. Comment text is stripped of its `/**`, `*/`
and per-line `*` and joined; a file with no comments is unchanged.

Harvesting at index time rather than from the frame means the dossier reads
correctly for a story that has never been opened, and needs no protocol
change. Note `useStoryRegistry` keys instruments on `stableStringify(entry)`,
so editing a doc comment rebuilds that story's instrument — which is what
should happen.

## Tests

`PaletteRegion`: an item with `onActivate` presses instead of selecting, is
never `active`, and leaves `activeToolId` alone; an item without one keeps
today's behavior.

`dossier.ts`: assembles identity from an entry, pairs schema leaves with trial
config values, and survives a trial whose instrument has not reported a schema
yet.

`indexFile.ts`: harvests a story's JSDoc, the meta's JSDoc and the component
identifier; a file with no comments produces the same entries as today.

`StoryInfoDialog`: opens from the palette item, names the focused story, and
closes on Escape.
