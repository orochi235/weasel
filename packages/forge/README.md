# @weasel-js/forge

A component workshop built on labkit. It reads Storybook's story files and
renders each story in the workshop page as a labkit trial: the story's
controls, state, undo and snapshots live in the trial, so two settings of one
component can be compared side by side.

## What the index reads

The story list is read from each file's source without running it, and a
loaded story takes its title from that list. So a meta's `title` has to be
readable there: a string, a template with no expression, or a `const` of the
same file holding one. Any other title, such as an imported constant, is
passed over for the title the file's path gives it. In a file whose meta is
forge's `meta`, a story is an export that calls `story`, directly or through
a function that returns the call, and an import or a re-export is followed to
its declaration to see whether it is one. Anything else the file exports, such
as `export const rows = makeRows()` or a constant from another module, is not
listed.

## Where a story renders

A story renders inside a host element in the workshop document. The host
carries the theme attributes the globals resolve to, keeps its CSS variable
overrides on itself, contains its fixed-position descendants, and is where
weasel overlays portal, so a Dialog opened in one trial stays in that trial.
`vw`, `vh` and media queries read the workshop page, not the host; a story
with a `viewport` renders as a fixed-size box the trial pans and zooms.

A story that needs a document of its own says so, with the reason:

```tsx
export const Interactive = story({ isolate: 'asserts placement against the window edge', render: … });
// CSF: parameters: { forge: { isolate: 'asserts placement against the window edge' } }
```

It then renders in an iframe. The frame path
gets no new features; `npm run check:forge-isolate`
lists the isolated stories and fails when their number goes above the one the
script holds, so the count only goes down. The value is read from the source
without running it, and must be a string literal.

If the count ever reaches
zero, the frame side goes: `FrameView`, `framePool`, `keptFrame`, `trialFrames`,
`answers`, `readyKey`, `labHarness`, `mountFrame`, `protocol/*`, the frame
entry, `frame.html`, `html.ts`, the frame page in `build.ts`, the `./frame`
and `./frame.css` exports, the ratchet script, and the `docs/TODO.md` entries
about frame reloads; `defineFrameConfig` folds into one config.

## Config modules

The vite plugin takes two optional config modules:

- `frameConfig` default-exports `defineFrameConfig({...})`: decorators around
  every story, `applyGlobals` for what a global does to a story's host (or to
  a frame document's root, for an isolated story), `cssVarsScope`,
  `parameters`, the project-wide CSF parameters that Storybook keeps in
  `preview`, and `prepare`, awaited before a story first renders, which is
  where to import what only some stories need. `applyGlobals` is handed a
  target: its `root`, a `scope` selector matching only that root, and
  `style(css)` for a rule that should reach that story alone.
- `shellConfig` default-exports `defineShellConfig({...})`: lab chrome, control
  renderers, and global declarations. Only the workshop page imports it.
  `title` names the workshop in its header and as the document title
  (default `weaselforge`). The CSS Vars panel stays hidden until its header toggle
  is pressed, and the lab remembers the choice; `cssVars: false` leaves out both.
  `libraries` names the project's libraries, each a stretch of file path, a
  label and an optional badge tone: `{ path: '/packages/ui/', label: 'ui' }`.
  The tree's package filter, index pages, and Get Info show the label; a
  story under none of them takes its title's first segment.

```ts
forge({ stories: ['src/**/*.stories.tsx'], frameConfig: 'forge.frame.tsx', shellConfig: 'forge.shell.tsx' });
```

The workshop page imports the frame config too, so a stylesheet it imports
styles the workshop as well. CSS meant for frame documents alone, such as a
page background on `html, body`, goes in `frameStyles`, a list of stylesheet
paths that only the frame document loads.

Editing a story file reloads that story in every trial showing it, with the
trial's config and state kept; the page itself stays.

Clicking a story in the tree, or reaching one by its URL, shows it in the
focused trial; Shift-click opens another trial beside it.

## Knobs in the URL

A story's URL carries its knobs — its args, the trial's controls — after the
story id, in the hash:

```
/#/ui-button--primary?label=Save&look.px=8&disabled=true
```

Opening that URL shows the story with those values; every knob it leaves out
is at its default. Changing a control rewrites the URL in place, without a
history entry, and a value back at its default leaves the URL. Moving to
another story starts with no knobs. Typing new knobs into the URL of the open
story applies them.

A knob inside a group is named by its dotted path (`look.px`). Each value is
read as its control's type, or its default's when the control declares none:
a number, `true`/`false` (`1`/`0`, or a bare `?disabled`, also work), one of an
enum's options, a string, or JSON for a list or object. A value that does not
read as its type, or names no knob, is ignored. `t` is reserved for the
workshop and is never a knob.

The functions behind this are exported from `@weasel-js/forge`, for a host
building links: `storyHref('ui-button--primary', { label: 'Save', 'look.px': 8 })`
returns `#/ui-button--primary?label=Save&look.px=8`, and `parseRoute`,
`paramsToKnobs` and `knobsToParams` read and write the same form against a
story's schema.

## Timelines

A story that declares a timeline gets a playhead, and its trial gets a
transport in the status bar: a scrub bar, play and pause, loop, and rate. Times
are in ms, as `@weasel-js/ui`'s timeline components take them.

```tsx
import { story, usePlayhead } from '@weasel-js/forge';

function Ball() {
  const t = usePlayhead(); // ms
  return <circle cx={t / 10} cy={10} r={8} />;
}

export const Swing = story({
  timeline: { duration: 4000, start: -500, loop: true, rate: 1 },
  render: () => <svg><Ball /></svg>,
});
// CSF: parameters: { forge: { timeline: { duration: 4000 } } }
```

The span runs from `start` (default 0; below zero is a lead-in) for `duration`.
`loop` defaults to true and `rate` to 1. A meta's `timeline` covers every story
in its file. A function in place of the object is handed the trial's config, or
a CSF story's args, so the span can follow a control:
`timeline: (config) => ({ duration: config.seconds * 1000 })`.

`usePlayhead()` returns the time, and re-renders only the component that calls
it. `useTimeline()` returns the whole clock — `time`, `playing`, `span`, `loop`,
`rate` — with `play`, `pause`, `seek`, `setLoop`, `setRate`, and `setSpan` for a
span the story learns only once it runs (null goes back to the declared one).
Either throws in a story that declares no timeline.

The clock belongs to the trial, so two trials of one story play independently.
It runs only while the story's box is on screen and the page is visible. Its
paused time is kept with the trial, so a reload or a loaded snapshot brings the
story back there; it is written when the clock stops or moves while stopped,
never on a playing frame.

While the clock is paused off its span's start, the URL holds the playhead in
seconds, so a paused frame works as a link: `#/<story>?t=1.5`. Opening that URL
starts the story paused at 1.5s, over any kept time, and a hash change that
brings a different `t` seeks there and pauses. Playing drops `t` rather than
rewriting it every frame. Only one trial holds the URL, as for knobs: the
focused trial when it shows the routed story, else the first that does. An index page, an
isolated story's frame and a story test show the story paused at its span's
start, with no transport.

## Loupe

A lens shows the patch of a story under its reticle, magnified, or rendered
under a different condition, or both. Lenses float over the whole workshop:
one stays where it was put while the panes under it scroll and zoom, and one
parked over a trial can aim at another. They last for the session and are not
saved with a trial. Drag a lens or its reticle to move it, drag its edge to
resize it, and press Delete to close a selected one; the lenses keep an undo
history of their own.

Every lens key is in the Loupe keymap. Alt+L opens it, a hint lists its keys
while it is open, and Escape closes it. Holding Alt+L keeps it open, so a Follow
lens can be pinned while the pointer is still on the story. Inside it, each key
acts on the selected lens, or on the last one added when none is selected:

| Key | Does | Key | Does |
|---|---|---|---|
| `l` | add a lens | `Shift+L` | close the lens |
| `p` | pin the reticle | `f` | make the reticle follow the pointer |
| `v` | Live source | `x` | Pixels source |
| `r` | Pixels at 1×, 2×, or both side by side | `=` / `-` | zoom in / out |
| `o` | compare with the opposite mode | `k` | choose a comparison |
| `Shift+O` | clear the comparison | `s` / `\` / `d` | Swap / Split / Difference |
| `t` | Token readout | `c` | Contrast readout |
| `g` | pixel grid | | |

Each binding's id is its action id (`loupe.add`, `loupe.view.split`, …), so a
binding override can rebind it. Alt+Slash opens a panel listing every key
binding the workshop registers, the lens keys included.

Token shows the color at the aim and the `--wzl-*` token chain behind it;
Contrast shows the WCAG ratio of the text there against its background, with
AA and AAA marks, read from computed styles on a Live lens and from the pixels
on a Pixels one; the pixel grid draws from 8× up on a Pixels lens. On a Live lens
with a comparison, Token and Contrast read the compared copy. Token reads the
DOM, so a Pixels lens with a comparison has none to give.

**Live** renders the story a second time inside the lens, with the
comparison's globals or args laid over the trial's. It is sharp at any factor
and interactive, and it is never the real pixels. **Pixels** asks the dev server
for a PNG of the story rendered in headless Chromium at a chosen DPR and enlarges
it nearest-neighbor, so a hairline half a pixel off looks as it does on screen.
A capture reproduces the story's args, globals, trial state, playhead, CSS
variable overrides, scroll position and the lab's theme; it lags the live story
by one capture, and has no hover or focus in it. Difference always compares two
Pixels captures, whichever source the lens shows.

Playwright is an optional peer dependency. Without it, or without its Chromium
(`npx playwright install chromium`), a lens says why Pixels is unavailable and
offers Live only. The endpoint imports `@weasel-js/core/json`, which resolves to
core's built `dist`, so build core before starting the dev server in a fresh
checkout.

The endpoint is `<base>__forge/capture`, on the dev server only. A GET says
whether captures are available, without starting Chromium; a POST takes a JSON
payload and answers with the PNG. It is guarded against being used to load
anyone else's page:

- The capture page's URL is built from the socket the request arrived on,
  never from its `Host` header.
- A POST must be `application/json`, and one whose `Origin` is not the dev
  server's own is refused.
- A CSS variable override must be a custom property name with no `{`, `}` or
  `;` in its value, and overrides are written through the CSSOM.
- The capture page can load nothing but the dev server's own origin and the
  origins the shell config lists in `capture.allowOrigins`, such as a web-font
  service's:

```ts
defineShellConfig({ capture: { allowOrigins: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'] } });
```

Captures are cached in the dev-server process, at most 64 entries and 64 MB of
PNG bytes, least recently used out first. The cache is cleared on any client
module update and when the server closes. There is one Chromium, started on the
first capture that misses the cache and closed after 120 s idle or when the
server closes.

## Index pages

Every component — every story title — has an index page, opened by clicking
the component's row in the sidebar (its fold mark only folds it) and routed at
`#/<title id>:index`. It renders all
of the component's stories in one trial: each at its defaults, then once per
value of each of its boolean and enum controls, one control at a time.

Under its title, an index page lists the components it uses and the ones that
use it, each linking to that component's index page. The plugin reads these
from source, not from anything an author writes: a component is the binding its
meta's `component` names, followed through imports and re-exports (barrels
included) to the file declaring it. When `component` is declared in the story
file itself, or absent, the import the title's last segment names stands in.
What it uses is every listed component that declaration reaches, through that
file's local helpers and the relative imports in its own directory. A component
whose file forge cannot find says so on its page and lists nothing. The graph is
built the first time the workshop asks for it, after the page is up, and an edit
re-reads only the file it touched.

A component can supply its own page. A native meta takes `index`; a CSF meta
sets `parameters.forge.index`. Either is handed an `IndexContext` holding the
stories and the generated page's parts, `Story`, `Variants` and `DefaultIndex`,
so a custom page composes them:

```tsx
export default meta({
  title: 'ui/Button',
  index: ({ stories, Story, DefaultIndex }) => (
    <>
      <Story story={stories[0]} config={{ label: 'Save' }} label="In a form" />
      <DefaultIndex />
    </>
  ),
});
```

A custom page gets the list as `Dependencies`, and `gallery` says whether the
component is one.

Above the list the page says which release the component first shipped in and
when its source file was created and last changed. All three come from git:
the dates are the file's first and latest commits, followed back through
renames, and the release is the nearest tag after the first, taken from the
file's own package's tags (`@scope/pkg@1.2.0`) and unscoped ones (`v1.2.0`).
A file not yet in a tagged release reads `Unreleased`, and a file git has
never committed shows nothing. A custom page gets it as `History`.

## Galleries

A story file that catalogs many components, or every permutation of one, tags
its meta `gallery`, CSF's own `tags` field; a single such story tags itself.
Tags must be string literals, since the index reads them without running the
file. A story's tags are its meta's plus its own, and `'!gallery'` on a story
drops the meta's.

```ts
const meta: Meta = { title: 'ui/Icons/Gallery', tags: ['gallery'] };
export const AllPermutations: Story = { tags: ['gallery'], render: … };
```

A gallery row carries a grid mark in the sidebar and a Gallery badge on its
index page. A component every one of whose stories is a gallery is left out of
the dependency lists entirely, so a catalog that imports everything does not
appear as a user of everything.

## Story tests

`forgeTest` from `@weasel-js/forge/vite` runs every story as a vitest browser
test: each story renders in the test page through the same host the workshop
uses, with its defaults, plays, and fails on any fault. Pass it the same `frameConfig`. It needs vitest 4 or 5 in browser mode with a provider, such as
`@vitest/browser-playwright`. This repo runs it with
`npm run test:stories:forge`, not in CI.
