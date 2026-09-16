# weaselforge: a component workshop built on labkit

**Status: built 2026-09-13.** Retiring Storybook is the next arc (`docs/TODO.md`, forge section).

For whoever implements `@weasel-js/forge`. Assumes you know labkit's lab /
instrument / trial model and what Storybook does; nothing about the session that
produced this.

**What this answers:** how to replace Storybook with a tool built on labkit,
without labkit taking on anything story-shaped.

## Why labkit

A Storybook story is a component rendered from a set of controls. A labkit
instrument is already that, with more: typed controls (`f.schema`), state,
undo, snapshots, persistence, chrome contributions, and several trials open side
by side, which is what makes comparing two settings of one component possible.
The repo's Storybook use is shallow (89 story files, ~355 stories, nearly all
plain `render` + `args`, two `play` functions, no autodocs or MDX), and labkit's
own stories already fight it: `.storybook/preview.tsx` redeclares Oswald and
wraps every `labkit/…` story in `.lk-root` by hand.

## Scope of this arc

Build forge and run it **beside** Storybook, reading the same 89 files. Retiring
Storybook — uninstalling it, moving the Pages entry, dropping
`packages/ui/.storybook` and the unused `addon-themes` — is the next arc.

Not in this arc: an accessibility panel (axe running in the frame, results over
the channel), autodocs, MDX, CSF loaders / `beforeEach` / `tags` (no story uses
them).

## Package boundary

`packages/forge`, published as `@weasel-js/forge`, CLI binary `weaselforge`
(not `forge`: Foundry installs one). It owns the story format, the CSF loader,
the vite plugin, the frame runtime, the channel, the workshop page, the static
build and the vitest plugin.

**labkit never learns what a story is.** forge imports only labkit's public
exports, and turns each story into an ordinary `Instrument` at that boundary. A
`check:forge-boundary` script fails when labkit imports forge, or forge imports
a path inside `packages/labkit/src`.

labkit changes only where forge exposes a gap that is engine surface on its own
terms. Two, each its own commit with tests and a `patch` changeset, landing
before forge uses it:

1. **Instruments added or replaced while a lab is mounted.** `<Lab>` opens its
   store once (`packages/labkit/src/lab/Lab.tsx`, `useOpenOnce`) and collects
   serializers, config defaults and config migrations from `instruments` at that
   moment; `addTrial` throws on a name it did not see then
   (`trial/trialOps.ts`, `findInstrument`). A changed `instruments` list must
   re-collect all three and be addable. A trial whose instrument disappears
   already renders "Unknown instrument" (`trial/Trial.tsx`); keep that.
2. **A `sidebar` lab region**, beside `header | palette | footer`
   (`chrome/labTypes.ts`), wide enough for a tree rather than a tool rail.

Isolation needs no labkit change: `render` returns a `ReactNode`, and an iframe
is one.

## Isolation: one document per story

Each trial's `render` returns an `<iframe src="frame.html#<storyId>">`. The
frame is its own document and JS realm: it imports that one story module,
applies globals and decorators, renders the component, and runs `play`. The
workshop page never imports a story module, so component CSS never reaches the
lab chrome.

Rejected: portalling one React tree into a same-origin iframe. `applyTheme`
writes its rules to the global `document.head`
(`packages/theme/src/applyTheme.ts`), vite injects every stylesheet there, and
anything portalling to `document.body` or reading `window.matchMedia` gets the
parent. A shadow root isolates CSS only, with no viewport of its own.

## Story format

`render`, decorators and `play` run in the frame. Config and state belong to the
trial in the workshop page, so they must be serializable (structured clone).

```tsx
export default meta({ title: 'ui/Slider', decorators: [withPanel] });

export const Basic = story({
  config: f.schema({ value: f.number(50).range(0, 100).slider() }),
  state: () => ({ drags: 0 }),
  render: ({ config, setConfig, state, setState }) => (
    <Slider value={config.value} onChange={(v) => setConfig('value', v)} />
  ),
  layout: 'centered', // 'centered' | 'padded' | 'fullscreen'
  viewport: { width: 375, height: 812 }, // optional fixed size
  play: async ({ canvas, userEvent, expect }) => {},
});
```

State living in the trial is what gives a story undo, snapshots and persistence.

### How the workshop learns a story's controls

1. The vite plugin parses each story file's exports without executing it,
   producing the story index: id, title, export name, file.
2. Opening a story registers a provisional instrument whose `render` is the
   iframe and whose schema is empty.
3. The frame sends `ready` with a serialized schema; forge rebuilds it with `f`
   and replaces the instrument (labkit gap 1).

Three parts of a schema are functions and cannot cross:

| Part | Where it runs |
|---|---|
| `showIf` | frame; reports the hidden paths on each config change |
| `validate` | frame; reports errors by path |
| `.render` (custom control) | workshop page, from a `controls` registry in the shell config — the same `controls` `<Lab>` takes |

### CSF loader

Reads a CSF file's default export and named exports into the same story shape.
`args` become a schema by the type of their default value; `argTypes` refine
it:

| CSF control | `f` |
|---|---|
| `number`, `range`, `slider` | `f.number().range().step()`, `.slider()` for `range`/`slider` |
| `boolean`, `switch` | `f.boolean()`, `.toggle()` for `switch` |
| `text`, `textarea` | `f.string()` |
| `select` | `f.enum()` |
| `radio`, `inline-radio` | `f.enum().radio()` |
| `object` | `f.custom('json', arg)`, control supplied by forge's shell |
| `control: false` | hidden |

Function-valued args (the repo's are no-op handlers like `onClick: () => {}`)
stay in the frame and are not controls. `useArgs` becomes a frame hook writing
through `setConfig`. `parameters.layout` → `layout`, `parameters.viewport` →
`viewport`, story `globals` → globals.

### Global setup

Two config modules, because they run in different realms. The vite plugin takes
their paths as `frameConfig` and `shellConfig`; only frame documents import the
first, so its CSS stays out of the workshop.

- frame config (`defineFrameConfig`): global decorators, and what each global
  does to the frame (mode → `applyTheme` on the frame root; font → the
  family/weight/width/italic snapping `preview.tsx` does).
- shell config (`defineShellConfig`): global declarations for the toolbar,
  chrome contributions, control renderers.

## The channel

Each trial creates a `MessageChannel` and transfers one port to its iframe on
load, so frames cannot hear each other. The frame accepts that handoff only from
its parent window at its own origin, and only the first one. Every message
carries a protocol version; a mismatch is a `fault`.

| Direction | Messages |
|---|---|
| workshop → frame | `init {config, state, globals}` · `config` · `state` · `globals` · `vars.set` · `play` |
| frame → workshop | `ready {schema, layout, viewport}` · `answers {configKey, hidden, errors}` · `setConfig` · `setState` · `size` · `vars` · `played` · `fault {phase, message, stack, seq?}` |

A render fault carries how many `init`, `config`, `state` and `globals` messages
the frame had received, so the workshop ignores a fault older than its latest input.

A story's `state(config)` is a function, so the trial's instrument starts its
state at `null`; a frame handed `null` computes the story's initial state and
sends it back with `setState`. Reset works the same way.

`showIf` and `validate` answers depend on the config they were asked about, and
two trials of one story hold different configs, so the frame reports each answer
keyed by the config it evaluated, and the workshop's rebuilt predicates look up
the answer for the config they are handed.

Annotation capture across the frame boundary is not in this arc.

The trial's copy of config and state is authoritative. A control edit sends
`config` in; a story's own `setConfig` sends a write out and the trial applies
it, so undo and snapshots see every change from both sides.

### Lifecycle

1. Trial mounts; iframe loads `frame.html#<storyId>`.
2. Frame imports the story, sends `ready`.
3. forge registers the real instrument and sends `init` with the stored config,
   or defaults.
4. Updates flow both ways.

**Hot reload** happens inside the frame, since vite serves it. A changed schema
re-sends `ready`; forge replaces the instrument and stored config fills its gaps
from the new defaults, as labkit already does.

**Sizing.** `centered` and `padded` are CSS inside the frame; `fullscreen` gives
the story the whole frame. A story with a `viewport` uses labkit's `stage`
capability: the iframe is fixed-size DOM the trial pans and zooms, so a phone
width and a desktop width sit side by side.

**Errors.** An error boundary in the frame catches import failures, render
throws and `play` rejections, and sends `fault`; the trial shows it in place of
the story and in its status bar. A frame that never sends `ready` within a
timeout shows a load error naming its URL. A fault never takes down the workshop
page.

**WebGL contexts** are capped per renderer process, and a same-origin iframe
usually shares its parent's. Many canvas-heavy trials open at once could exhaust
them, so a frame whose trial is out of view should unmount; its state is already
in the trial. **Not built** — `docs/TODO.md`, forge section.

## Workshop page

A `<Lab>` with a `storageKey` (IndexedDB), so open trials, config, snapshots and
layout survive a reload.

- **Story tree** in the lab `sidebar` region. Titles split on `/`; a filter box
  matches names. Clicking a story runs it in the focused trial, the one last
  pointed at or focused, or flashes that trial when it already runs the story.
  Shift-click (or Shift+Enter) opens another trial.
- **Routing:** `#/<storyId>` opens or reveals that story. The hash carries the
  route, not lab state.
- **Globals** (mode, font) are lab-wide from the header toolbar. A trial can pin
  its own: forge adds a reserved `$globals` group to every story schema, so a
  pinned value gets undo, snapshots and persistence through labkit's own config
  path. The lab's Auto/Light/Dark buttons theme the chrome only; stories follow
  the lab's mode unless their globals say otherwise.
- **CSS Vars panel**, ported from `.storybook/addons/css-vars/`, in the lab's
  aside on the right. It shows the focused trial, and names it. The Theme tab
  reads `@weasel-js/theme`'s token manifest (`TOKEN_MANIFEST`) directly, so the
  generated `tokens.generated.ts` copy goes away with Storybook's addon. The Story tab's `var()` scan runs in the
  frame and arrives as `vars`. An override is sent into that trial's frame
  rather than written to a page-wide `:root` rule.

## Testing

- **Unit, jsdom, in CI.** A `forge` vitest project covering: the protocol over
  two in-memory ports; the CSF→`f` mapping against fixtures copied from real
  `argTypes`; schema serialization including the `showIf` and `validate`
  round-trips; the provisional→real instrument swap. Register the project in
  `check:test-projects`.
- **Stories, browser, local only.** A vitest plugin generates one test per
  story: mount the frame runtime directly (no workshop page), render at
  defaults, run `play`. Kept out of CI for the reason `ci.yml` gives for the
  `storybook` project — Playwright plus ~250 MB of browser to prove stories
  mount. Run as `test:stories:forge`.

⚠️ The two `play` tests with real assertions (`LabFit.stories.tsx`,
`Persistence.stories.tsx`) still run in no CI, as today.

## Build and delivery

`weaselforge dev` and `weaselforge build`, both thin over the vite plugin.
`build` emits a static site: workshop page, frame page, one chunk per story.
`pages.yml` publishes it at `dist-demo/docs/ui/forge/`, beside Storybook. A
`dev:forge` script joins `npm run dev`, with the server bound to `::`.

## Phases

Each ends with something runnable.

1. labkit gap 1 (mutable instrument list), then gap 2 (`sidebar` lab region).
2. Package scaffold, frame runtime, channel, native story format, dev plugin: one
   native story renders in a trial and round-trips config and state.
3. CSF loader: a script loads all 89 files, one progress line per file
   (`12/89`), and lists faults.
4. Workshop page: tree, routing, globals, CSS Vars panel.
5. Static build, Pages entry, story-test project.
