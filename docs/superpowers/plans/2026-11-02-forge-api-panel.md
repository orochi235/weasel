# forge index page API panel: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** unbuilt (2026-11-02). Branch `forge-api-panel`, worktree `../weasel-forge-api-panel`.

**Goal:** Every forge index page shows the component's API in its right half: every prop (type, required, default,
JSDoc), the props it inherits, collapsed, and the members of the handle its `ref` exposes.

**Architecture:** forge's TypeScript reader (`packages/forge/src/vite/propTypes.ts`), which already finds each story
file's component and reads its props for controls, gains a second reading that keeps every prop rather than only
those a control can edit. The vite transform that appends `__forgeArgTypes` to a story module appends `__forgeApi`
beside it. The index bundle carries it from the primary story file, and the generated page lays the stories and the
API side by side.

**Tech Stack:** TypeScript compiler API (the project's own `typescript`), vite plugin transform, React, CSS container
queries.

**Spec:** the design approved in conversation (2026-11-02), restated here:

| Piece | Decision |
|---|---|
| Props | every prop: name, type as written in its declaration (else as the checker prints it), required, default, JSDoc, `@deprecated` |
| Defaults | the component function's destructuring default (`{ size = 'md' }`), else a `@default` JSDoc tag |
| Inherited | props whose every declaration is in a skipped file (React's or TypeScript's own types, or `propControls.skip`) collapse to one line per declaring interface: "+ 31 from SVGAttributes" |
| Methods | the members of the type the `ref` prop takes: methods with their signatures, then properties (`readonly` marked), each with JSDoc. A ref to a platform type (`HTMLUListElement`) names the type and lists nothing |
| Layout | two equal columns, stories left, API right; the API column sticks to the top of the page's scroller and scrolls on its own; below 900px of page width the API stacks under the page header |
| No API | a gallery shows no panel; a page whose component forge could not find says so in one line, in the panel's place |
| Custom pages | `IndexContext.Api`, beside `Dependencies` and `History` |
| Delivery | a named export on the story module, as `__forgeArgTypes` is; no new virtual module, so the static build gets it too |

## Global Constraints

- Every changeset is `patch`.
- No source file over 400 lines, no function over 120 (`npm run check:size`). `IndexPage.tsx` is at 332: the panel
  goes in a new file.
- No inline styles beyond the existing `minHeight` placeholder; no `!important`. Numbers in tables use
  `font-variant-numeric: tabular-nums` (`@weasel-js/theme/numeric.module.css`).
- The page root never scrolls the document: the trial's own scroller does (`StoryScroller`).
- US English in all copy.

## Review Focus

- **Very long type text** (react-aria unions, `ReactNode`, generics): wraps inside its cell and never widens the API
  column or scrolls the page sideways. Owned by Task 3.
- **A component whose props are mostly inherited** (react-aria `AriaButtonProps` brings dozens): those collapse, and
  the panel's own list stays short. Owned by Task 1.
- **`memo(forwardRef(fn))` and generic components** (`<T,>(props: ListProps<T>) => …`): props, defaults and ref
  still read; type text shows `T`. Owned by Task 1.
- **A reader failure on one file** warns and leaves the story module and its controls intact, as `propControls`
  already does. Owned by Task 2.
- **A component with no props and no ref**: the panel says "Takes no props." rather than rendering empty headings.
  Owned by Task 3.

---

### Task 1: Read a component's API

**Files:**
- Create: `packages/forge/src/story/api.ts` (types and the export name; imported by both the plugin and the page)
- Create: `packages/forge/src/vite/apiTable.ts`
- Modify: `packages/forge/src/vite/propTypes.ts` (export the component lookup; add `PropReader.api`)
- Test: `packages/forge/src/vite/apiTable.test.ts`

**Interfaces:**
- Produces, in `story/api.ts`:

```ts
export const API_EXPORT = '__forgeApi';
export interface ApiProp { name: string; type: string; required: boolean; default?: string; description?: string; deprecated?: string }
export interface ApiMember { name: string; kind: 'method' | 'property'; signature: string; readonly: boolean; description?: string }
export interface ApiInherited { from: string; count: number }
export interface ApiRef { type: string; members: ApiMember[] }
export interface ApiTable { props: ApiProp[]; inherited: ApiInherited[]; ref: ApiRef | null; sources: string[] }
```

- Produces, in `propTypes.ts`: `PropReader.api(file: string, fallback?: string): ApiTable | null`. `fallback` is the
  local import name standing in for a meta with no `component` (a native `meta()`), as the dependency graph already
  does: the title's last segment. Null when neither names a component.
- Produces, in `apiTable.ts`: `apiTable(reading: ApiReading, component: ts.Symbol, props: ts.Type): ApiTable`, where
  `ApiReading` is `{ tsm, checker, at: ts.SourceFile, skipped: (file: string) => boolean }`.

- [ ] **Step 1: Write the failing tests** in `apiTable.test.ts`, with a temp-dir fixture in the shape of
  `propTypes.test.ts` (a local `react.ts` declaring `forwardRef`, `memo` and `Ref<T>`; a
  `node_modules/@types/react/dom.d.ts` declaring `interface DomProps { hidden?: boolean; title?: string }`):
  - `lists every prop, controls or not`: `onPress` is `{ type: '() => void', required: false }`, `label` is
    `{ required: true, description: 'Shown beside the glyph.' }`.
  - `writes a type as its declaration spells it`: `weight` reads `'Weight'`, not the expanded union.
  - `reads a default from destructuring, else from @default`: `count = 3` gives `'3'`; `/** @default 'md' */ size`
    gives `"'md'"`.
  - `marks a deprecated prop`: `/** @deprecated use tone */ loud?: boolean` gives `deprecated: 'use tone'`.
  - `collapses props declared in skipped files`: a props type extending `DomProps` gives
    `inherited: [{ from: 'DomProps', count: 2 }]` and neither prop in `props`.
  - `reads the members of a forwardRef handle`: `ref.type === 'ChartHandle'`; `toModel` is
    `{ kind: 'method', signature: '(pt: Point) => Point' }`; `width` is `{ kind: 'property', readonly: true }`;
    neither `ref` nor `key` appears in `props`.
  - `names a platform ref type and lists nothing`: a component forwarding to `HTMLDivElement` gives
    `ref: { type: 'HTMLDivElement', members: [] }`.
  - `unwraps memo(forwardRef(fn)) for defaults and ref`.
  - `reads a generic component`: `ListProps<T>`'s `items` reads `'T[]'`.
  - `follows the fallback import for a meta with no component`.
  - `returns null when nothing names a component`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run packages/forge/src/vite/apiTable.test.ts`
Expected: FAIL, `apiTable` / `PropReader.api` not defined.

- [ ] **Step 3: Implement.** Split `componentProps` in `propTypes.ts` into `componentOf(…) → { symbol, props } | null`
  so both readings share the lookup, and have it take the fallback name. In `apiTable.ts`: defaults from the
  component's declaration, unwrapping `memo(…)`/`forwardRef(…)` call initializers to the inner function and reading its
  first parameter's `ObjectBindingPattern` initializers as source text; the ref from the `ref` prop's non-nullable
  type, taking the union part with a `current` property and that property's type minus `null`; a member is a method
  when its type has call signatures (`checker.signatureToString`); a platform ref type is one whose declarations pass
  the platform test. `sources` collects non-`node_modules` declaring files, as `propTable` does.

- [ ] **Step 4: Run the tests to see them pass**, plus `propTypes.test.ts` unchanged.

Run: `npx vitest run packages/forge/src/vite/apiTable.test.ts packages/forge/src/vite/propTypes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit** — `read a component's props and ref handle for its index page`

### Task 2: Carry the API to the index bundle

**Files:**
- Modify: `packages/forge/src/vite/propControls.ts`, `packages/forge/src/vite/plugin.ts` (option)
- Modify: `packages/forge/src/story/indexBundle.ts`, `packages/forge/src/frame/index/indexEnv.ts`,
  `packages/forge/src/frame/index/IndexPage.tsx` (`IndexEnv.api` only)
- Test: `packages/forge/src/vite/plugin.test.ts`, new `packages/forge/src/story/indexBundle.test.ts`

**Interfaces:**
- Consumes: `PropReader.api`, `API_EXPORT`, `ApiTable` (Task 1).
- Produces: plugin option `api?: boolean` (default `true`; the reader runs when either `api` or `propControls` is
  on); `IndexBundle.api: ApiTable | null | undefined` (undefined: the module carries none, so the page shows nothing;
  null: read, and no component found); `IndexEnv.api` the same, always `undefined` for a gallery.

- [ ] **Step 1: Write the failing tests.**
  - `plugin.test.ts`, `appends the component's API to a story module`: the served module's text contains
    `export const __forgeApi = ` and parses to a table whose `props` includes the fixture's props; with `api: false`
    it does not.
  - `plugin.test.ts`, `serves a story whose API cannot be read`: a reader that throws in `api` leaves
    `__forgeArgTypes` present and logs one warning naming the file.
  - `indexBundle.test.ts`, `takes the API from the primary file`: two files, only the primary's module carrying
    `__forgeApi`, give `bundle.api` equal to it; a module with `__forgeApi = null` gives `null`; none gives `undefined`.

- [ ] **Step 2: Run to see them fail.**

Run: `npx vitest run packages/forge/src/vite/plugin.test.ts packages/forge/src/story/indexBundle.test.ts`

- [ ] **Step 3: Implement.** The transform passes the file's fallback name from its index entries (the title's last
  segment); it calls `addWatchFile` for `ApiTable.sources` as it already does for prop sources. The loader reads the
  export with a plain-object check, as `loadCsfModule` does for argTypes.

- [ ] **Step 4: Run to see them pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** — `carry each component's API from its story module to its index page`

### Task 3: The API panel and the two-column page

**Files:**
- Create: `packages/forge/src/frame/index/IndexApi.tsx`, `packages/forge/src/frame/index/api.css`
- Modify: `packages/forge/src/frame/index/IndexPage.tsx` (`DefaultIndex` layout, `indexContext`),
  `packages/forge/src/frame/index/index.css`, `packages/forge/src/story/types.ts` (`IndexContext.Api`)
- Test: new `packages/forge/src/frame/index/IndexApi.test.tsx`; `packages/forge/src/frame/index/index.browser.test.tsx`

**Interfaces:**
- Consumes: `IndexEnv.api` (Task 2).
- Produces: `IndexApi(): ReactNode`, exported and given as `IndexContext.Api: ComponentType`.

Page structure: `DefaultIndex` renders `<div class="fg-index-layout">` holding the existing header, the stories
column and `<IndexApi />` as an `<aside aria-label="API">`. Inside it: an `h2` "Props" over a `<dl>` (a `dt` per prop
name with a "required" badge, a `dd` holding the type in `<code>`, "Default: …", and the description); one line per
inherited source; an `h2` "Ref" naming the ref type over the same `<dl>` shape for its members, methods first.

- [ ] **Step 1: Write the failing tests** in `IndexApi.test.tsx` (envs built as `IndexPage.test.tsx` builds them):
  - `lists each prop with its type, default and description`.
  - `marks a required prop` (badge text `required`) and `a deprecated one` (text `Deprecated: use tone`).
  - `collapses inherited props to one line per source`: text `+ 2 from DomProps`.
  - `lists the ref handle's methods before its properties`.
  - `names a platform ref type with no member list`.
  - `says when a component takes no props`: `Takes no props.`
  - `says when forge found no component`, for `api: null`.
  - `shows no panel for a gallery`, and none for `api: undefined`.
  - `is a part a custom page can place`: a custom `render` using `ctx.Api` shows the panel.
  - `passes axe` via `runAxe`.
  - In `index.browser.test.tsx`: `keeps the API column in view while the page scrolls` (scroll the trial's scroller
    by 2000px; the aside's top stays at the scroller's top), `stacks the API under the header below 900px`, and
    `wraps a long type inside the column` (a 400-character union leaves `scrollWidth === clientWidth` on the
    scroller).

- [ ] **Step 2: Run to see them fail.**

Run: `npx vitest run packages/forge/src/frame/index/IndexApi.test.tsx`, then
`npx vitest run --project=browser packages/forge/src/frame/index/index.browser.test.tsx`

- [ ] **Step 3: Implement.** `.fg-index-layout` is a container (`container-type: inline-size`) with a two-column grid
  and no max-width of its own; `.fg-index`'s 1200px cap moves to the single-column case. The aside is
  `position: sticky; top: 0` with its own `overflow: auto` and a max height of its scroller's; `<code>` type text uses
  `overflow-wrap: anywhere`. `@container (width < 900px)` stacks it.

- [ ] **Step 4: Run to see them pass**, plus `IndexPage.test.tsx` unchanged. Same commands. Expected: PASS.

- [ ] **Step 5: Look at it.** Start forge (`npm run dev` in `apps/forge`, in the background), open
  `ui/Plot2D`'s and `ui/Button`'s index pages headless, screenshot both at 1600px and at 800px, and
  `transom post` the four shots to the `weasel` zone. Plot2D shows its handle's methods; Button collapses react-aria's
  props.

- [ ] **Step 6: Commit** — `show each component's props and ref handle beside its index page`

### Task 4: Docs, changeset, TODO

**Files:**
- Modify: `packages/forge/README.md` ("Index pages": the panel, what it reads, the `api` option, `IndexContext.Api`)
- Create: `.changeset/forge-api-panel.md` (`'@weasel-js/forge': patch`)
- Modify: `docs/TODO.md` (the typedoc P2 entry: drop "in progress, branch `forge-api-panel`")
- Delete: this plan

- [ ] **Step 1:** Write the README paragraph and the changeset; reword the TODO entry.
- [ ] **Step 2:** Run the branch's checks: `npm run typecheck:packages -- forge`, eslint on the changed files,
  `npm run check:size`, `npm run check:bumps`.
- [ ] **Step 3: Commit** — `document forge's API panel`, deleting this plan in the same commit. Report the branch as
  ready for the next batch.
