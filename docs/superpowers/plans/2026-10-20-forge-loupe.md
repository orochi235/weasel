# Forge Loupe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: unbuilt (2026-10-20).** Delete this file when the branch merges.

**Goal:** Give weaselforge lenses that sit over the workshop as scene nodes and show a story patch magnified, through a Live copy of the story or a real Pixels capture, compared against other conditions, with readouts — every control a labkit action with a default key.

**Architecture:** Lenses are three nodes (body, reticle, leader) in a labkit-owned scene drawn by a `<SceneCanvas>` into the lab's shared `over` buffer, with one hit box per node so pointer misses fall through to the story; this follows `AnnotationOverlay`, the one existing scene-over-DOM tenant. labkit (`@weasel-js/labkit/loupe`) owns the lens objects, the actions, the source contract, the comparison views and the pixel readouts; forge configures it and supplies the Live source (a second `TrialHost` portaled from the trial into the lens), the Pixels source (a dev-server endpoint driving headless Chromium) and the Token readout.

**Tech Stack:** React 19, `@weasel-js/core` scene/ops/actions, labkit surface and chrome, vite 8 dev-server middleware, Playwright (optional peer), vitest projects `forge`, `forge-node`, `labkit`, `weasel-ui`, `browser`.

**Spec:** `docs/superpowers/specs/2026-10-20-forge-loupe-design.md`

## Spec corrections

Where the code disagrees with the spec, or the spec is silent on something the code forces, this plan does the following.

1. **Nothing can mount over the lab body today.** `<Lab>` renders its `children` inside the header, and `labChrome` regions are `header | palette | sidebar | aside | footer`. The only layer above the trials is `LabSurface`'s `over` layer, which only trial tiles reach. The plan adds an `overlay` lab region rendered by `LabSurface`. It covers the lab body: trials, palette and side panes, but not the header.
2. **Delete does not couple body and reticle on its own.** Glass works as the spec says: the reticle carries a registered `derivePose`, and `createSetDependsOnOp` switching its `dependsOn` between `undefined` and `[body]` is the whole switch. While Glass is on, core's `moveSources` hands a reticle drag to the body, which is the right behavior. But a Pinned reticle depends on nothing, so core's delete cascade removes only the node you selected. The reticle cannot depend on the body in Pinned either, because any node carrying `derivePose` with a non-empty `dependsOn` has its drags handed to its dependencies. The plan has the lens canvas override its `delete` action so it deletes whole lenses, still through `createDeleteOp`. This is the one place the "no loupe-specific delete code" anti-goal bends (see "Could not resolve").
3. **Difference appears twice in the spec, as a comparison view and as a readout.** The plan makes it one setting (`view: 'difference'`); the readout toggle is the same action.
4. **Forge has no idea which global is "mode".** `mode` is a key that `apps/forge` declares, and its lab value can be `auto` or `app` (`FOLLOW_APP`), neither of which has an opposite until it is resolved. The plan adds `GlobalDeclaration.opposite` and `ShellConfig.loupe.modeGlobal` (default `'mode'`).
5. **A DPR comparison only applies to Pixels.** A Live render cannot change the device pixel ratio, so a Live lens with a `dpr` condition says so instead of drawing anything.
6. **Token cannot read a Pixels capture taken under changed conditions.** There is no DOM to read. Token reads the Live copy, or the main story when nothing is changed, and otherwise reports that it needs a Live source.
7. **Isolated stories have no playhead.** The frame protocol (`protocol/messages.ts`) carries no time, and a frame's `WithStoryClock` stands paused at the span's start. A capture of an `isolate` story sends `playhead: null`, which reproduces what the frame shows.

## Global Constraints

- Every changeset is `patch`, with no bump marker.
- `npm run check:size`: no file over 400 lines and no function over 120, except files already in `scripts/check-size.allow.json`, whose entries only come down. `TrialHost.tsx` (fn 132), `FrameView.tsx` (fn 225), `vite/plugin.ts` (fn 272) and `lab/Lab.tsx` (fn 197) must not grow. Split first, then lower the entry with `npm run check:size -- --update`.
- No bare `requestAnimationFrame` or `setInterval` (`npm run check:frame-loops`). Any loop goes through `useVisibleRaf`.
- Tools stay declarative shells. Lens move, resize, select and undo are core's `features={['pick','move','transform','edit']}` on the lens canvas, with no hand-rolled gesture.
- A tool or action hook never calls `useAction`. Actions register through `registry.register` in an effect, as `LoupeGestures.tsx` does.
- Re-export from another workspace package by name, never `export *`. Declare every new import in its package's manifest (`npm run check:imports`).
- No inline styles. Measured rects go through CSS custom properties, as `.lk-annotate__input` does. No `!important`.
- Browser-only facts (pointer fall-through, pixels, layout) are `*.browser.test.tsx` files in the `browser` project. jsdom tests assert state or proxies, and say so when a proxy stands in.
- Playwright is an optional peer of `@weasel-js/forge`. Without it the Pixels source reports itself unavailable and the lens offers Live only.
- Capture cache: at most 64 entries **and** at most 64 MB of PNG bytes, least-recently-used out first. It lives in the dev-server process and is cleared on any client module update and on server close. One Chromium, launched on first capture and closed after 120 s idle or on server close.
- At most 8 lenses at once (`MAX_LENSES = 8`). Every Live lens is a whole second render.
- Lenses last for the session (in memory at the `Workshop`) and are never written to trial storage.
- The lens scene keeps its own undo history, separate from `varsHistory`. It answers undo keys only while its input element has focus.
- Leader scopes are out of scope. Keys are plain default bindings.
- US English in code, copy and commits. Commit subjects are imperative and lower-case, and every commit ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work in a worktree (`git worktree add .claude/worktrees/forge-loupe -b forge-loupe`, then `npm ci` inside it). Before merging, run `npm run test:gate` and `npm run test:fleet -- HEAD` on the branch.

## Review Focus

1. **A story scrolled inside its host, or a workspace pane zoomed.** The lens must show the patch the reticle sits on. A Live copy matches the main host's scroll offsets, and both sources map client to host-local points by the host rect's scale (Task 6, Task 9).
2. **Typing a lens key into a story's text field.** Typing `l` in an `<input>` inside a story must add no lens (Task 4).
3. **Trial state that JSON cannot carry** (a `Map`, a function, a class instance). The Pixels source must report "unavailable: this story's state cannot be sent to a capture" rather than capture a different story (Task 9).
4. **A story file edited while a Pixels lens is up.** The next capture must be fresh, never a pre-edit image from the cache (Task 8, Task 9).
5. **A reticle over no trial, or over a trial that just closed.** The lens shows "Nothing under the reticle" and unmounts any copy, with no throw (Task 6).

---

## File map

| Path | Owns |
|---|---|
| `packages/labkit/src/chrome/labTypes.ts` | `LabRegion` gains `'overlay'` |
| `packages/labkit/src/chrome/regions/OverlayRegion.tsx` | renders `overlay` contributions |
| `packages/labkit/src/lab/LabSurface.tsx` | takes `contributions`, renders `OverlayRegion` after the trials |
| `packages/labkit/src/loupe/lens/lensTypes.ts` | lens node data, settings, ids |
| `packages/labkit/src/loupe/lens/lensScene.ts` | scene creation, registry, node specs, lens ops, closure |
| `packages/labkit/src/loupe/lens/lensHitBoxes.ts` | per-node hit rects, pure |
| `packages/labkit/src/loupe/lens/LensOverlay.tsx` | canvas, input layer, hit boxes, slots |
| `packages/labkit/src/loupe/lens/LensChrome.tsx` | the strip under a body: source label, compare label, toggles |
| `packages/labkit/src/loupe/lens/lensSource.ts` | source contract for live, pixels, revision, reference |
| `packages/labkit/src/loupe/lens/LensSlot.tsx` | mounts the source or sources into a body's interior, by view |
| `packages/labkit/src/loupe/lens/lensActions.ts` | action ids, default keys, `createLensActions` |
| `packages/labkit/src/loupe/lens/LensActions.tsx` | registers them, plus the Follow hover dispatcher |
| `packages/labkit/src/loupe/lens/compare.ts` | split geometry, `loupe.seam` |
| `packages/labkit/src/loupe/lens/difference.ts` | `diffPixels` |
| `packages/labkit/src/loupe/lens/pixelGrid.ts` | `softEdgeMask`, `drawPixelGrid` |
| `packages/labkit/src/loupe/lens/Lens.less` | lens styles |
| `packages/paint/src/contrast.ts` | `contrastRatio`, `wcagLevels` |
| `packages/svg/src/index.ts` | exports `specificity`, `compareSpecificity` |
| `packages/forge/src/shell/hostConditions.ts` | globals target and overrides on a host element; used by `TrialHost` and capture |
| `packages/forge/src/shell/TrialHost.tsx` | `copy` mode |
| `packages/forge/src/shell/StoryTrial.tsx` | renders Live copies into lens slots |
| `packages/forge/src/shell/loupe/liveLenses.ts` | store of Live requests per trial |
| `packages/forge/src/shell/loupe/trialAt.ts` | client point → trial host and host-local point |
| `packages/forge/src/shell/loupe/LiveCopies.tsx` | per trial, the portaled copies |
| `packages/forge/src/shell/loupe/conditions.ts` | `ForgeComparison`, resolution, opposite mode |
| `packages/forge/src/shell/loupe/liveSource.ts` | the Live `LensSource` |
| `packages/forge/src/shell/loupe/pixelsSource.ts` | the Pixels `LensSource` |
| `packages/forge/src/shell/loupe/capturePayload.ts` | builds the payload from a trial |
| `packages/forge/src/shell/loupe/ForgeLoupe.tsx` | the overlay contribution forge mounts |
| `packages/forge/src/shell/loupe/tokenChain.ts` | element under aim → color → `--wzl-*` chain |
| `packages/forge/src/shell/loupe/readouts.tsx` | Token and Contrast readouts |
| `packages/forge/src/shell/cssVars/reveal.ts` | `revealVar(name)` |
| `packages/forge/src/shell/keys/KeysPanel.tsx`, `keysChrome.ts` | the key-bindings panel |
| `packages/forge/src/shell/frameLink.ts` | `FrameView`'s link logic, split out |
| `packages/forge/src/vite/virtualModules.ts` | the `modules` table out of `forge()` |
| `packages/forge/src/vite/capture/*.ts` | endpoint, browser pool, cache, page entries |
| `packages/forge/src/frame/capture/CaptureView.tsx`, `mountCapture.tsx` | the page a capture renders |

---

### Task 1: TrialHost renders a second copy

**Files:**
- Create: `packages/forge/src/shell/hostConditions.ts`
- Modify: `packages/forge/src/shell/TrialHost.tsx`
- Test: `packages/forge/src/shell/TrialHost.copy.test.tsx`

**Interfaces:**
- Consumes: `createGlobalsTarget`, `createOverrides` (existing).
- Produces:
  - `useHostConditions(host: HTMLElement | null, opts: { hostId: string; globals: Globals; overrides: CssOverrides; setup: FrameSetup }): RefObject<Overrides | null>`. It applies the globals target and persisted overrides under `[data-fg-host="<hostId>"]` and owns no registry connection.
  - `TrialHostProps.copy?: { id: string; globals: Globals }`. When `copy` is given, the host id is `copy.id`, the element carries `data-fg-copy=""`, `copy.globals` replaces the computed globals, nothing connects to or reports to `TrialFramesContext`, no a11y highlighter is created, and `onRendered` is not called.

- [ ] **Step 1: Write the failing tests**

```tsx
describe('TrialHost copy', () => {
  it('scopes its globals to its own id, leaving the main host styled by its own', () => {
    // main and copy under one TrialIdContext 't1'; copy={{ id: 't1~lens-a', globals: { mode: 'dark' } }}
    expect(main.dataset.fgHost).toBe('t1');
    expect(copyEl.dataset.fgHost).toBe('t1~lens-a');
    expect(copyEl.hasAttribute('data-fg-copy')).toBe(true);
    expect(applyGlobals.mock.calls.find(([, t]) => t.root === main)![0]).toEqual({ mode: 'light' });
    expect(applyGlobals.mock.calls.find(([, t]) => t.root === copyEl)![0]).toEqual({ mode: 'dark' });
  });
  it('stays out of the frame registry: the main host stays connected through the copy mounting and unmounting', () => {
    const connected = () => frames.get('t1').send;
    const before = connected();
    rerenderWithCopy(); expect(connected()).toBe(before);
    rerenderWithoutCopy(); expect(connected()).toBe(before);
  });
  it('carries the trial’s persisted CSS overrides under its own scope', () => {
    // fg-css-overrides = { '--wzl-accent': 'red' } in trial scope
    expect(overrideRuleText()).toContain('[data-fg-host="t1~lens-a"]');
  });
});
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/shell/TrialHost.copy.test.tsx`. Expected: FAIL, because `copy` is not a prop.
- [ ] **Step 3: Extract `useHostConditions`** from `TrialHost`'s globals-target effect and overrides effects into `hostConditions.ts`. `TrialHost` keeps its registry effect, gated on `!copy`. Run `npx vitest run --project=forge packages/forge/src/shell/TrialHost.test.tsx`. Expected: PASS, unchanged.
- [ ] **Step 4: Add `copy`.**
- [ ] **Step 5: Run both test files.** Expected: PASS. Then run `npm run check:size`. If `TrialHost` fell below 132, run `npm run check:size -- --update`.
- [ ] **Step 6: Commit.**

```bash
git add packages/forge/src/shell/{hostConditions.ts,TrialHost.tsx,TrialHost.copy.test.tsx} scripts/check-size.allow.json
git commit -m "let TrialHost render a second copy with its own host id and globals, outside the frame registry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: The lens scene

**Files:**
- Create: `packages/labkit/src/loupe/lens/lensTypes.ts`, `packages/labkit/src/loupe/lens/lensScene.ts`
- Test: `packages/labkit/src/loupe/lens/lensScene.test.ts`

**Interfaces:**
- Consumes: `createScene`, `createInsertOp`, `createDeleteOp`, `createSetDataOp`, `createSetDependsOnOp`, `createTransformOp`, `RectPose` from `@weasel-js/core`.
- Produces:

```ts
export type LensAim = 'pinned' | 'follow' | 'glass';
export type LensView = 'swap' | 'split' | 'difference';
export type LensSourceKind = 'live' | 'pixels' | 'revision' | 'reference';
export type LensReadout = 'token' | 'contrast' | 'grid';
export interface LensSettings<C> {
  aim: LensAim; source: LensSourceKind; factor: number; dprs: readonly number[];
  compare: C | null; view: LensView; seam: number; readouts: readonly LensReadout[]; shape: LoupeShape;
}
export interface LensBodyData<C> extends LensSettings<C> { role: 'lens-body'; lensId: string }
export interface LensReticleData { role: 'lens-reticle'; lensId: string }
export interface LensLeaderData { role: 'lens-leader'; lensId: string }
export type LensNodeData<C> = LensBodyData<C> | LensReticleData | LensLeaderData;
export type LensScene<C> = Scene<LensNodeData<C>, 'lenses', RectPose>;
export interface LensIds { lensId: string; body: NodeId; reticle: NodeId; leader: NodeId }
export const LENS_DEFAULTS: LensSettings<never>; // aim 'pinned', source 'live', factor 4, dprs [1], view 'swap', seam 0.5, readouts [], shape 'circle'
export const GLASS_POSE_KEY = 'labkit:lens-glass';
export const LEADER_PATH_KEY = 'labkit:lens-leader';
export const BODY_SIZE = 160; export const RETICLE_SIZE = 16;
export function createLensScene<C>(): LensScene<C>;
export function addLensOps<C>(scene: LensScene<C>, lensId: string, at: { body: LoupePoint; reticle: LoupePoint }, settings?: Partial<LensSettings<C>>): Op[];
export function lensIdsOf<C>(scene: LensScene<C>, nodeId: string): LensIds | null;
export function lensesOf<C>(scene: LensScene<C>): readonly LensIds[];
export function lensClosure<C>(scene: LensScene<C>, ids: readonly string[]): string[];
export function settingsOf<C>(scene: LensScene<C>, lensId: string): LensSettings<C> | null;
export function setLensOps<C>(scene: LensScene<C>, lensId: string, patch: Partial<Omit<LensSettings<C>, 'aim'>>): Op[];
export function setAimOps<C>(scene: LensScene<C>, lensId: string, to: LensAim): Op[];
```

The reticle is added with `derivePose` set to the registry's `GLASS_POSE_KEY` function and no `dependsOn`. That function returns a `RETICLE_SIZE` box centered on `deps[0].pose`, or `null` when no dependency is given. The leader is added with `dependsOn: [body, reticle]` and a `LEADER_PATH_KEY` `derivePath`: a segment from the body's rim to the reticle's center, or `null` while the reticle lies inside the body. Node ids are `` `${lensId}:body` ``, `` `${lensId}:reticle` `` and `` `${lensId}:leader` ``. `setAimOps` emits a `createSetDataOp` on the body, plus `createSetDependsOnOp` on the reticle (`undefined` ↔ `[body]`) when Glass is entered or left.

- [ ] **Step 1: Write the failing tests**

```ts
it('adds a lens as a body, a pinned reticle and a leader joining them', () => {
  apply(addLensOps(scene, 'a', { body: { x: 300, y: 200 }, reticle: { x: 100, y: 100 } }));
  expect(lensesOf(scene)).toEqual([{ lensId: 'a', body: 'a:body', reticle: 'a:reticle', leader: 'a:leader' }]);
  expect(scene.get('a:reticle')!.dependsOn).toBeUndefined();
  expect(settingsOf(scene, 'a')).toMatchObject({ aim: 'pinned', source: 'live', factor: 4 });
});
it('moves a pinned reticle on its own: dragging it writes the reticle, not the body', () => {
  expect(moveSources(scene, ['a:reticle'])).toEqual(['a:reticle']);
});
it('makes Glass two kit calls: the reticle sits at the body’s center, dragging it moves the body, and undo restores Pinned', () => {
  apply(setAimOps(scene, 'a', 'glass'));
  expect(centerOf(effectivePose(scene, 'a:reticle'))).toEqual({ x: 300, y: 200 });
  expect(moveSources(scene, ['a:reticle'])).toEqual(['a:body']);
  scene.history.undo();
  expect(scene.get('a:reticle')!.dependsOn).toBeUndefined();
  expect(settingsOf(scene, 'a')!.aim).toBe('pinned');
});
it('closes over whole lenses from any one of their nodes', () => {
  expect(lensClosure(scene, ['a:reticle']).sort()).toEqual(['a:body', 'a:leader', 'a:reticle']);
});
it('round-trips through a serialized history with the glass and leader functions restored by key', () => { /* serialize, restore with LENS_REGISTRY, effectivePose equal */ });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=labkit packages/labkit/src/loupe/lens/lensScene.test.ts`. Expected: FAIL, because the module is missing.
- [ ] **Step 3: Implement** `lensTypes.ts` and `lensScene.ts` with the signatures above. `createLensScene` passes `{ derivePose: { [GLASS_POSE_KEY]: … }, derivePath: { [LEADER_PATH_KEY]: … } }` as its registry.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `add the lens scene: body, reticle and leader nodes with a glass-ready reticle`.

### Task 3: The overlay region, the lens canvas, and pass-through hit boxes

**Files:**
- Modify: `packages/labkit/src/chrome/labTypes.ts`, `packages/labkit/src/lab/LabSurface.tsx`, `packages/labkit/src/lab/Lab.tsx` (one line: `<LabSurface bodyRef={setLabBody} contributions={labChromeAll}>`)
- Create: `packages/labkit/src/chrome/regions/OverlayRegion.tsx`, `packages/labkit/src/loupe/lens/lensHitBoxes.ts`, `packages/labkit/src/loupe/lens/LensOverlay.tsx`, `packages/labkit/src/loupe/lens/Lens.less`
- Test: `packages/labkit/src/loupe/lens/lensHitBoxes.test.ts`, `packages/labkit/src/chrome/regions/OverlayRegion.test.tsx`, `packages/labkit/src/loupe/lens/LensOverlay.browser.test.tsx`

**Interfaces:**
- Consumes: Task 2's scene API. `useSurfaceOptional`, `useSurfaceCanvas('over')`, `useSurfaceTile`, `SceneCanvas`, `WeaselProvider isolate`, the `CameraWheelContext` pattern from `AnnotationOverlay`.
- Produces:
  - `LabRegion` includes `'overlay'`. Only the `render` form is valid for it. `LabSurface` renders `OverlayRegion` after `children`, inside the surface contexts.
  - `interface LensHitBox { nodeId: string; role: 'lens-body' | 'lens-reticle'; rect: LoupeRect; round: boolean }`
  - `hitBoxesOf<C>(scene: LensScene<C>, selected: ReadonlySet<string>): readonly LensHitBox[]`. The rects are effective poses in lab-body px. A selected body's rect grows by `HANDLE_SLOP = 12` on every side so its transform handles stay reachable. Leaders get no box.
  - `LensOverlayProps<C> { scene: LensScene<C>; attachment?: LensAttachment; children?: (lens: LensIds, interior: HTMLElement) => ReactNode; onFocusLens?: (lensId: string | null) => void }`
  - `interface LensAttachment { view(): View; subscribe(listener: () => void): () => void }` is the camera the lens scene is drawn and picked through. It defaults to `VIEWPORT_ATTACHMENT` (identity: lenses stay put in lab-body px), which is forge's choice. A host attaching lenses to a pane passes that pane's camera. Persistence is the host's too: it owns the `scene` it passes in. Together these are the spec's "attachment and persistence are host options".
  - `<LensOverlay>` registers tile `lab-loupe` on a full-size `.lk-lens-layer` portaled into `surface.getContainer()`. It paints the scene into the `over` buffer with `paintInto` and `features={['pick','move','transform','edit']}`. Its input element is `.lk-lens-input` (`pointer-events: none`, `role="application"`, `tabIndex={0}`), and that element holds one `.lk-lens-hit` (`pointer-events: auto`, `border-radius: 50%` when `round`) per box, so a press on a hit box bubbles to the dispatcher. It overrides the canvas's `delete` action (`actions={{ delete: lensDeleteAction }}`) so it deletes `lensClosure` of the selection through `createDeleteOp`. It renders one `.lk-lens-interior` per body for `children`.

- [ ] **Step 1: Write the failing jsdom tests**

```ts
it('gives each body and reticle a box at its effective pose, and none to the leader', () => {
  expect(hitBoxesOf(scene, new Set()).map((b) => b.role)).toEqual(['lens-body', 'lens-reticle']);
});
it('places boxes through the attachment’s view: a pane camera at 2× doubles the rects', () => { /* attachment view scale 2 */ });
it('grows a selected body’s box by the handle slop', () => {
  expect(hitBoxesOf(scene, new Set(['a:body']))[0]!.rect.w).toBe(BODY_SIZE + 24);
});
it('renders overlay contributions inside the lab surface, after the trials', () => { /* Lab with labChrome [{id:'x', region:'overlay', render:()=> <i data-testid="o"/>}]; expect o inside .lk-lab__body */ });
```

- [ ] **Step 2: Write the failing browser test.** This is the riskiest fact in the plan: that `setPointerCapture` on a `pointer-events: none` input element still lets a drag that starts on a hit box finish.

```tsx
it('lets a press that misses every lens reach the story underneath', async () => {
  await userEvent.click(page.getByRole('button', { name: 'Under' })); // a button beneath the lab body, away from the lens
  expect(clicks).toBe(1);
});
it('drags a body with core’s move, leaving the pinned reticle where it was', async () => {
  await drag(bodyCenter, { dx: 40, dy: 0 });
  expect(pose(scene, 'a:body').x).toBe(before.x + 40);
  expect(pose(scene, 'a:reticle')).toEqual(reticleBefore);
});
it('undoes the drag with the lens focused', async () => { /* Meta+Z → back */ });
it('deletes the whole lens when only its reticle is selected', async () => { /* click reticle, Backspace → lensesOf(scene) empty */ });
it('keeps painting lenses while a trial is expanded', async () => { /* expand trial, read over-buffer pixel at body rim: non-transparent */ });
```

- [ ] **Step 3: Run to verify failure.** Run `npx vitest run --project=labkit packages/labkit/src/loupe/lens packages/labkit/src/chrome/regions` and `npx vitest run --project=browser packages/labkit/src/loupe/lens/LensOverlay.browser.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement the region, the hit boxes and the overlay.** Body and reticle shapes register through `registerNodeShape`. Lens colors come from `--wzl-*` tokens, read once with `getComputedStyle` on the layer. If the expanded-trial test fails because the surface scope drops the `lab-loupe` tile, register it with the lightbox's lifted layer, the way `LightboxLayers` lifts `above`, rather than special-casing scope.
- [ ] **Step 5: Run to verify the tests pass.** Expected: PASS. Also run `npm run check:size` (Lab.tsx must be unchanged in length) and `npm run typecheck`.
- [ ] **Step 6: Commit** with the subject `add a lab overlay region and a lens canvas whose misses fall through to the trials`.

### Task 4: Lens actions, Follow, and default keys

**Files:**
- Create: `packages/labkit/src/loupe/lens/lensActions.ts`, `packages/labkit/src/loupe/lens/LensActions.tsx`
- Modify: `packages/labkit/src/loupe/index.ts` (export everything in `lens/` by name)
- Test: `packages/labkit/src/loupe/lens/lensActions.test.ts`, `packages/labkit/src/loupe/lens/LensActions.test.tsx`

**Interfaces:**
- Consumes: Task 2's ops and Task 3's overlay. `heldKeySpec` and the `Action` type from core.
- Produces:

```ts
export interface LensActionApi {
  current(): string | null;               // focused or selected lens, else the most recently added
  add(at?: LoupePoint): string | null;    // null when MAX_LENSES are up
  apply(ops: readonly Op[]): void;
  scene: LensScene<unknown>;
  follow(client: LoupePoint): void;       // writes the reticle through scene.overrides.hold()
  sourceAvailable(kind: LensSourceKind): true | string;
  openCompareMenu(lensId: string): void;
}
export const MAX_LENSES = 8;
export const LENS_ACTION_IDS: { add: 'loupe.add'; close: 'loupe.close'; pinned: 'loupe.aim.pinned'; follow: 'loupe.aim.follow';
  followMove: 'loupe.follow'; live: 'loupe.source.live'; pixels: 'loupe.source.pixels'; dpr: 'loupe.dpr.next';
  swap: 'loupe.view.swap'; split: 'loupe.view.split'; difference: 'loupe.view.difference';
  opposite: 'loupe.compare.opposite'; compareMenu: 'loupe.compare.menu'; clearCompare: 'loupe.compare.clear';
  token: 'loupe.readout.token'; contrast: 'loupe.readout.contrast'; grid: 'loupe.readout.grid';
  zoomIn: 'loupe.factor.in'; zoomOut: 'loupe.factor.out' };
export function createLensActions(api: LensActionApi, comparisons: { opposite: () => unknown }): readonly Action[];
export function LensActions(props: { api: LensActionApi; bodyRef: RefObject<HTMLElement | null>; opposite: () => unknown }): null;
```

Default keys. Each binding is a `{ kind: 'key', key, phase: [{ channel: '*', phase: 'initial' }] }`, and every action except `loupe.add` returns `'not-applicable'` from `enabled` while no lens is up:

| Action | Key | Action | Key |
|---|---|---|---|
| `loupe.add` | `l` | `loupe.close` | `Shift+L` |
| `loupe.aim.pinned` | `p` | `loupe.aim.follow` | `f` |
| `loupe.source.live` | `v` | `loupe.source.pixels` | `x` |
| `loupe.dpr.next` | `r` | `loupe.view.swap` | `s` |
| `loupe.view.split` | `\` | `loupe.view.difference` | `d` |
| `loupe.compare.opposite` | `o` | `loupe.compare.menu` | `k` |
| `loupe.compare.clear` | `Shift+O` | `loupe.readout.token` | `t` |
| `loupe.readout.contrast` | `c` | `loupe.readout.grid` | `g` |
| `loupe.factor.in` | `=` | `loupe.factor.out` | `-` |

`loupe.follow` binds `{ kind: 'hover', held: 'optional', mods: ANY_MODS }` on a dispatcher that `LensActions` mounts on the lab body with `channels: { pointer: false, hover: true, contextMenu: false, ingest: false }`. That is `LoupeGestures`' own-dispatcher pattern, and the action is enabled only while the current lens's aim is `follow`. `loupe.aim.pinned` from Follow commits the held reticle pose with one `createTransformOp` and releases the hold. `loupe.dpr.next` cycles `[1] → [2] → [1, 2] → [1]`. Factor steps by ×2, clamped to `[1, 64]`. `loupe.source.pixels` returns the source's unavailable reason from `enabled` when Pixels is missing. Every action registers on the lab registry (`useActionsRegistry()` at `LensActions`), in `group: 'loupe'`, with a `label` written for the key panel ("Add lens", "Close lens", "Aim: pinned", …).

- [ ] **Step 1: Write the failing tests**

```ts
it('adds a lens on l, up to eight, and declines the ninth with a reason', () => {
  for (let i = 0; i < 9; i++) registry.trigger('loupe.add');
  expect(lensesOf(scene)).toHaveLength(8);
  expect(actionOf('loupe.add').enabled!(deps)).toMatch(/8 lenses/);
});
it('switches aim to Follow, tracks hover without writing history, and commits one step on Pinned', () => {
  registry.trigger('loupe.aim.follow'); hover(dispatcher, 50, 60); hover(dispatcher, 70, 80);
  expect(scene.history.length).toBe(lengthBefore + 1); // the setData for aim only
  registry.trigger('loupe.aim.pinned');
  expect(centerOf(scene.get('a:reticle')!.pose)).toEqual({ x: 70, y: 80 });
});
it('cycles DPR 1×, 2×, 1×|2×', () => { /* three triggers → [2], [1,2], [1] */ });
it('declines every lens key but add while no lens is up', () => { /* enabled === 'not-applicable' */ });
it('types l into a story’s text input without adding a lens', async () => { /* Review Focus 2: Lab with an <input> trial; userEvent.type(input,'l'); lensesOf(scene) empty */ });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=labkit packages/labkit/src/loupe/lens/lensActions.test.ts packages/labkit/src/loupe/lens/LensActions.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** If the typing test fails, the lab dispatcher is not skipping editable targets. Fix that in routing's key matcher, with a test there in the `weasel-ui` project, rather than in the lens.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `add lens actions with plain default keys and a follow aim`.

### Task 5: The source contract and the lens slot

**Files:**
- Create: `packages/labkit/src/loupe/lens/lensSource.ts`, `packages/labkit/src/loupe/lens/LensSlot.tsx`, `packages/labkit/src/loupe/lens/LensChrome.tsx`
- Modify: `packages/labkit/src/loupe/lens/LensOverlay.tsx` (takes `sources`, renders a `LensSlot` and `LensChrome` per body in place of `children`)
- Test: `packages/labkit/src/loupe/lens/LensSlot.test.tsx`

**Interfaces:**
- Produces:

```ts
export type LensSourceStatus = { available: true } | { available: false; reason: string };
export interface LensSourceRequest<C> {
  lensId: string;
  reticle: LoupePoint;               // client px
  factor: number;
  size: { width: number; height: number };   // the interior, CSS px
  conditions: C | null;              // null: the story as it is
  dpr: number;
}
export interface LensCapture { bitmap: ImageBitmap; dpr: number; box: { width: number; height: number }; at: LoupePoint /* reticle in host px */ }
export interface LensSourceHandle<C> { update(request: LensSourceRequest<C>): void; detach(): void }
export interface LensSource<C> {
  readonly kind: LensSourceKind;
  readonly produces: 'dom' | 'pixels';
  label(request: LensSourceRequest<C>): string;      // shown on the lens chrome: "Live", "Pixels 2×"
  status(): LensSourceStatus;
  subscribe(listener: () => void): () => void;
  attach(slot: HTMLElement, request: LensSourceRequest<C>): LensSourceHandle<C>;
  capture?(request: LensSourceRequest<C>): Promise<LensCapture | null>;   // required when produces === 'pixels'
}
export type LensSources<C> = Partial<Record<LensSourceKind, LensSource<C>>>;
export interface LensSlotProps<C> { lens: LensIds; settings: LensSettings<C>; sources: LensSources<C>; reticle: LoupePoint; size: { width: number; height: number }; describe: (c: C) => string }
```

`LensSlot` attaches the chosen source to the interior. For `dprs: [1, 2]` with a pixels source it attaches twice, side by side. With no source, or one that is unavailable, it shows the reason and falls back to the first available source, which the chrome then names. `LensChrome` always shows `source.label(request)` and, with a comparison, `describe(compare)`, so no lens shows a render without naming it. Its toggles call `registry.trigger(id)`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('names the source it shows', () => { expect(chrome.textContent).toContain('Live'); });
it('falls back to Live and says why when Pixels is unavailable', () => {
  expect(chrome.textContent).toContain('Live');
  expect(slot.textContent).toContain('Pixels unavailable: install playwright');
});
it('attaches one pixels source per DPR side by side', () => { expect(attach).toHaveBeenCalledTimes(2); expect(attach.mock.calls.map(([, r]) => r.dpr)).toEqual([1, 2]); });
it('re-sends the request, not a re-attach, when the reticle moves', () => { expect(update).toHaveBeenCalled(); expect(attach).toHaveBeenCalledTimes(1); });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=labkit packages/labkit/src/loupe/lens/LensSlot.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `add the lens source contract for live, pixels, revision and reference sources`.

### Task 6: Forge mounts lenses with a Live source

**Files:**
- Create: `packages/forge/src/shell/loupe/{liveLenses.ts,trialAt.ts,LiveCopies.tsx,liveSource.ts,ForgeLoupe.tsx,loupe.css,conditions.ts}`. `conditions.ts` starts with `ForgeComparison`, `ResolvedConditions` and `resolveComparison` for `kind: 'custom'` only, with the types exactly as Task 10 gives them. Task 10 adds `'opposite-mode'` and `describeComparison`.
- Modify: `packages/forge/src/shell/StoryTrial.tsx` (renders `<LiveCopies>`), `packages/forge/src/shell/Workshop.tsx` (adds the `fg-loupe` overlay contribution and provides `LiveLensesContext`)
- Test: `packages/forge/src/shell/loupe/trialAt.test.ts`, `packages/forge/src/shell/loupe/LiveCopies.test.tsx`, `packages/forge/src/shell/loupe/live.browser.test.tsx`

**Interfaces:**
- Consumes: Task 1's `TrialHost copy`, Task 3's overlay region, Task 4's `LensActions`, Task 5's `LensSource`.
- Produces:

```ts
export interface TrialHit { trialId: string; host: HTMLElement; local: LoupePoint; scale: number }
export function trialAt(client: LoupePoint, doc?: Document): TrialHit | null; // nearest [data-fg-host] without data-fg-copy; local = (client - rect.origin) * host.offsetWidth / rect.width
export interface LiveRequest { lensId: string; slot: HTMLElement; hit: TrialHit; factor: number; size: { width: number; height: number }; globals: Globals | null; args: Readonly<Record<string, unknown>> }
export interface LiveLenses { set(lensId: string, request: LiveRequest | null): void; forTrial(trialId: string): readonly LiveRequest[]; subscribe(listener: () => void): () => void }
export function createLiveLenses(): LiveLenses;
export const LiveLensesContext: Context<LiveLenses | null>;
export function createLiveSource(lenses: LiveLenses, resolve: (c: ForgeComparison | null, base: Globals) => ResolvedConditions): LensSource<ForgeComparison>;
export function ForgeLoupe(props: { declarations: GlobalDeclarations; modeGlobal: string }): ReactNode;
```

`LiveCopies` sits inside `StoryTrial`, beside `TrialHost`. For each request on its trial, it portals into `request.slot` a `TrialHost copy={{ id: \`${trialId}~lens-${lensId}\`, globals }}` sized to the main host's `offsetWidth × offsetHeight`, inside a `.fg-lens-copy` wrapper. The wrapper's transform `translate(w/2 - local.x·f, h/2 - local.y·f) scale(f)` comes from CSS custom properties. The copy renders `StoryBody` with `config = setPaths(storyConfig, args)` and the trial's state and shared clock, and it does not call `useClockLoop`. Its `setConfig` drops writes to any path in `args` and passes the rest to the trial. It copies the main `.fg-story__scroll`'s `scrollTop` and `scrollLeft` on the main element's `scroll` event. A reticle with no trial under it sends `set(lensId, null)`, and the slot shows "Nothing under the reticle". `ForgeLoupe` holds the scene in `useState(createLensScene)`, so lenses last for the session and are never persisted. The first version has no `isolate` support: over an isolated trial the slot shows "Live needs a frame for isolated stories", and Task 7 removes that message.

- [ ] **Step 1: Write the failing tests**

```ts
it('maps a client point into a zoomed host’s own px', () => { /* rect 200 wide, offsetWidth 400 → local.x doubled */ });
it('skips copies when finding the trial under a point', () => { /* copy stacked over host → returns main host */ });
```
```tsx
it('renders a copy with the comparison’s globals and args, reading the trial’s state', () => { /* copy shows mode dark, arg label='B', state count from trial */ });
it('drops a copy’s write to an arg the comparison overrides, and passes others to the trial', () => { /* setConfig('label','x') ignored; setConfig('size',3) reaches trial */ });
it('unmounts the copy and says so when the reticle leaves every trial', () => { /* Review Focus 5 */ });
it('unmounts the copy, with no throw, when its trial closes under a lens', () => { /* Review Focus 5: close trial; slot text "Nothing under the reticle" */ });
```
```tsx
// live.browser.test.tsx
it('shows the patch under the reticle in a story scrolled inside its host', async () => {
  // Review Focus 1: scroll .fg-story__scroll by 300; reticle over a marker; elementFromPoint(lens center) inside the copy is that marker
});
it('keeps a popover opened in the copy inside the lens, in the copy’s mode', async () => { /* open menu in copy; its rect inside the lens interior; computed bg is the dark token */ });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/shell/loupe` and `npx vitest run --project=browser packages/forge/src/shell/loupe/live.browser.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** `Workshop` adds one `labChrome` entry, `{ id: 'fg-loupe', region: 'overlay', render: () => <ForgeLoupe … /> }`, and wraps the lab in `LiveLensesContext.Provider`. Re-measure on lab-body `scroll` (capture phase), on `resize`, and on scene change. There is no loop.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `mount lenses in the workshop with a Live source rendering a second copy of the story`.

### Task 7: Live lenses on isolated stories

**Files:**
- Create: `packages/forge/src/shell/frameLink.ts`
- Modify: `packages/forge/src/shell/FrameView.tsx`, `packages/forge/src/shell/storyInstrument.tsx`, `packages/forge/src/shell/loupe/LiveCopies.tsx`
- Test: `packages/forge/src/shell/FrameView.copy.test.tsx`

**Interfaces:**
- Produces:
  - `frameLink.ts` holds the parts of `FrameView` that live outside the component: `Link`, `closeLink`, `sendInputs`, `mismatchMessage`, and `useFrameLink(opts): { connect(frame: HTMLIFrameElement): void; link: RefObject<Link | null> }`. This brings `FrameView`'s longest function under 120.
  - `FrameViewProps.copy?: { id: string; globals: Globals; args: Readonly<Record<string, unknown>> }`. In copy mode the view never claims from the pool, never calls `useKeptFrame`, never connects to `TrialFramesContext`, never records answers, ignores `ready` for `onReady`, ignores the `open` message, and sends `storyConfig` with `args` laid over it.
  - Over an isolated trial, `LiveCopies` renders `<FrameView copy>` the way it renders `TrialHost copy` for an in-document story.

- [ ] **Step 1: Move the link logic out unchanged.** Run `npx vitest run --project=forge packages/forge/src/shell/FrameView` and `npx vitest run --project=browser packages/forge/src/shell/FrameView.browser.test.tsx`. Expected: PASS. Run `npm run check:size -- --update` and confirm the `FrameView.tsx` entry dropped or was removed.
- [ ] **Step 2: Write the failing tests**

```tsx
it('loads its own frame and leaves the trial’s registry entry alone', () => { expect(frames.get('t1').send).toBe(mainSend); });
it('sends init with the comparison’s globals and args', () => { expect(sent[0]).toMatchObject({ type: 'init', globals: { mode: 'dark' }, config: { label: 'B' } }); });
it('does not swap the trial when its story asks to open another', () => { expect(lab.swapTrial).not.toHaveBeenCalled(); });
```

- [ ] **Step 3: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/shell/FrameView.copy.test.tsx`. Expected: FAIL.
- [ ] **Step 4: Implement `copy`.**
- [ ] **Step 5: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 6: Commit** with the subject `give a Live lens on an isolated story a frame of its own`.

### Task 8: The capture endpoint

**Files:**
- Create: `packages/forge/src/vite/virtualModules.ts`, `packages/forge/src/vite/capture/{payload.ts,cache.ts,browser.ts,endpoint.ts,entries.ts}`, `packages/forge/src/frame/capture/{CaptureView.tsx,mountCapture.tsx}`
- Modify: `packages/forge/src/vite/plugin.ts`, `packages/forge/src/vite/servePages.ts`, `packages/forge/src/frame/index.ts` (export `mountCapture` by name), `packages/forge/package.json` (add `"playwright": "^1.50.0"` to `peerDependencies`, `optional: true` in `peerDependenciesMeta`), `vitest.config.ts` (add `packages/forge/src/vite/capture/endpoint.test.ts` to `VITE_SERVER_TESTS`)
- Test: `packages/forge/src/vite/capture/cache.test.ts` and `payload.test.ts` (both `forge` project), `packages/forge/src/vite/capture/endpoint.test.ts` (`forge-node` project), `packages/forge/src/frame/capture/CaptureView.test.tsx` (`forge` project)

**Interfaces:**
- Produces:

```ts
export interface CapturePayload {
  story: string;                       // index id
  isolate: boolean;                    // picks the document: shell styles or frame styles
  config: unknown;                     // story config, $-keys stripped, comparison args laid over
  state: unknown;                      // must survive JSON
  globals: Globals;
  overrides: Readonly<Record<string, string>>;
  playhead: number | null;
  box: { width: number; height: number };
  layout: Layout;
  dpr: number;                         // clamped to [1, 3]
}
export function parsePayload(body: unknown): CapturePayload | { error: string };
export interface CaptureCache { get(key: string): Buffer | undefined; set(key: string, png: Buffer): void; clear(): void; readonly size: number; readonly bytes: number }
export function createCaptureCache(limits?: { entries: number; bytes: number }): CaptureCache;   // defaults { entries: 64, bytes: 64 * 1024 * 1024 }
export const CAPTURE_PATH = '__forge/capture';
export const CAPTURE_PAGES = { shell: '__forge/capture.html', frame: '__forge/capture-frame.html' };
export interface CaptureBrowser { capture(url: string, payload: CapturePayload): Promise<Buffer>; close(): Promise<void> }
export function launchCaptureBrowser(load?: () => Promise<typeof import('playwright')>): Promise<CaptureBrowser | { unavailable: string }>; // idle close 120_000 ms; one context per DPR; captures queued one at a time, queue cap 8
export function serveCapture(server: ViteDevServer, base: string): { revise(): void };
export function mountCapture(options: { index: readonly IndexEntry[]; importers: FrameImporters; setup: FrameSetup }): void; // exposes window.__forgeCapture.render(payload): Promise<void>
```

Behavior:
- `GET <base>__forge/capture` answers `{ available: true }` or `{ available: false, reason }`. Missing Playwright gives `"install playwright"`; a Chromium launch failure gives its message.
- `POST` with a `CapturePayload` answers `image/png`, or `400 { error }`, or `503 { available: false, reason }`. A full queue also answers `503` with the reason `"capture queue is full"`.
- The cache key is `sha1(stableStringify(payload))`. `revise()` clears the cache. The plugin's `hotUpdate` calls `revise()` on every client update, and the server's `close` closes the browser and clears the cache.
- `CaptureView` renders the story in a `.fg-story[data-fg-host="capture"][data-fg-capture]` box of exactly `box` size. It goes through `useHostConditions` (Task 1) and `StoryHost`, with `ClockContext` set to `useStoryClock(spec, () => playhead)` and no loop. It resolves `render()` after `document.fonts.ready` and two `useVisibleRaf` ticks.
- The endpoint screenshots `[data-fg-capture]` at the context's `deviceScaleFactor`.
- `plugin.ts`: move the `modules` table into `virtualModules.ts` (adding `capture-entry.js` and `capture-frame-entry.js`), and replace the `servePages(...)` line with one call that serves pages and capture alike, so `forge()` gets shorter.

- [ ] **Step 1: Write the failing tests**

```ts
it('evicts least recently used past 64 entries', () => { /* 65 sets → size 64, first key gone */ });
it('evicts by bytes past 64 MB even under 64 entries', () => { /* two 40 MB buffers → size 1 */ });
it('rejects a payload whose dpr is out of range or whose box is empty', () => {});
```
```ts
// endpoint.test.ts (forge-node)
it('reports itself unavailable without playwright, and answers a POST with 503', async () => { /* load rejects */ });
it('serves a cached capture without launching again, and captures afresh after a story edit', async () => {
  // Review Focus 4: fake CaptureBrowser counting calls; POST twice → 1 call; touch story file → hotUpdate → POST → 2 calls
});
it('serves the capture pages under base', async () => { /* GET /base/__forge/capture.html → 200 html naming capture-entry.js */ });
```
```tsx
it('renders the story at its playhead, globals and overrides in a box of the payload’s size', async () => {});
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/vite/capture packages/forge/src/frame/capture` and `npx vitest run --project=forge-node packages/forge/src/vite/capture/endpoint.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `browser.ts` imports Playwright only through `load`, which defaults to `() => import('playwright')`.
- [ ] **Step 4: Run to verify the tests pass**, along with `npx vitest run --project=forge-node packages/forge/src/vite/plugin.test.ts`, `npm run check:size -- --update` (the `plugin.ts` entry must drop), and `npm run check:imports`. Expected: PASS.
- [ ] **Step 5: Do one real capture against the dev server.** This counts only if it actually runs. Run `npm run dev -w apps/forge` (or the repo's forge app script), then `curl -s -X POST localhost:<port>/__forge/capture -d @<payload.json> -o out.png`. Post the PNG with `transom post out.png` (zone `weasel`). If Chromium cannot start here, report the step as unrun.
- [ ] **Step 6: Commit** with the subject `add a dev-server capture endpoint that renders a story in headless Chromium, with a 64-entry, 64 MB cache`.

### Task 9: The Pixels source

**Files:**
- Create: `packages/forge/src/shell/loupe/capturePayload.ts`, `packages/forge/src/shell/loupe/pixelsSource.ts`
- Modify: `packages/forge/src/shell/loupe/ForgeLoupe.tsx` (registers `pixels`), `packages/forge/src/vite/entries.ts` (the shell entry forwards `forge:story` and importers updates to `workshop.revise()`), `packages/forge/src/shell/mountWorkshop.tsx` (`revise()` on the returned handle)
- Test: `packages/forge/src/shell/loupe/capturePayload.test.ts`, `packages/forge/src/shell/loupe/pixelsSource.test.ts`, `packages/forge/src/shell/loupe/pixels.browser.test.tsx`

**Interfaces:**
- Consumes: Task 8's `CapturePayload`, `CAPTURE_PATH`; Task 5's `LensSource`; Task 6's `trialAt`.
- Produces:

```ts
export function capturePayload(input: { entry: IndexEntry; config: unknown; state: unknown; globals: Globals; overrides: CssOverrides; host: HTMLElement; dpr: number; resolved: ResolvedConditions }): CapturePayload | { unavailable: string };
export function createPixelsSource(opts: { base: string; payloadFor: (hit: TrialHit, dpr: number, c: ForgeComparison | null) => CapturePayload | { unavailable: string }; fetch?: typeof fetch; revision: () => number; subscribeRevision: (fn: () => void) => () => void }): LensSource<ForgeComparison>;
export const RECAPTURE_DEBOUNCE_MS = 250;
```

`capturePayload` reads `$playhead` (or `null` when `isolate`), strips `$`-keys with `storyConfig`, lays the comparison's args over the config, and measures `box` from `host.offsetWidth` and `offsetHeight`. It answers `{ unavailable: "this story's state cannot be sent to a capture" }` whenever `JSON.parse(JSON.stringify(state))` would not deep-equal the state. The source polls `GET` status once at attach, and again on `subscribe`. `attach` draws into a `<canvas>` with `imageSmoothingEnabled = false`, cropping the PNG about `hit.local · dpr` at `factor / dpr`, and keeps the last image up while a newer capture is pending. `capture()` returns a `LensCapture`. Its client cache holds one image per lens per side; any revision bump drops it.

- [ ] **Step 1: Write the failing tests**

```ts
it('refuses a story whose state is a Map, naming why', () => { // Review Focus 3
  expect(capturePayload({ ...input, state: new Map([[1, 2]]) })).toEqual({ unavailable: "this story's state cannot be sent to a capture" });
});
it('carries args, globals, state, the playhead and the vars overrides', () => {});
it('sends no playhead for an isolated story', () => {});
it('debounces recapture to 250 ms while the reticle moves', () => {});
it('drops its last image on a revision bump', () => {});
```
```tsx
it('enlarges real pixels nearest-neighbor: a 1px hairline at 8× is an 8px band with hard edges', async () => { /* read lens canvas pixels */ });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/shell/loupe/capturePayload.test.ts packages/forge/src/shell/loupe/pixelsSource.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** The browser test needs a running endpoint and Playwright inside the browser project's server. If that cannot be set up, it mocks `fetch` with a fixture PNG, says so in the test, and the real path rests on Task 8 Step 5.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `add a Pixels lens source that enlarges a real capture of the story`.

### Task 10: Comparisons: Swap, Split, Difference, and opposite mode

**Files:**
- Create: `packages/labkit/src/loupe/lens/compare.ts`, `packages/labkit/src/loupe/lens/difference.ts`, `packages/forge/src/shell/loupe/conditions.ts`, `packages/forge/src/shell/loupe/CompareMenu.tsx`
- Modify: `packages/labkit/src/loupe/lens/LensSlot.tsx`, `packages/labkit/src/loupe/lens/lensActions.ts` (adds `loupe.seam`), `packages/forge/src/shell/globals.ts` (`GlobalDeclaration.opposite`), `packages/forge/src/config.ts` (`ShellConfig.loupe?: { modeGlobal?: string }`), `apps/forge/` shell config (declares `opposite` on `mode`)
- Test: `packages/labkit/src/loupe/lens/compare.test.ts`, `packages/labkit/src/loupe/lens/difference.test.ts`, `packages/forge/src/shell/loupe/conditions.test.ts`

**Interfaces:**
- Produces:

```ts
// labkit
export function splitRects(interior: LoupeRect, seam: number): { left: LoupeRect; right: LoupeRect; seamX: number };
export const SEAM_GRAB = 4;   // px either side of the seam
export function seamAction(api: LensActionApi): Action; // id 'loupe.seam', drag binding, scope 'hotkey', enabled only when the press is within SEAM_GRAB of a split lens's seam; previews locally, commits one createSetDataOp on release; seam clamped to [0.05, 0.95]
export interface DiffResult { image: ImageData; changed: number }
export function diffPixels(a: ImageData, b: ImageData, opts?: { tolerance?: number; lit?: readonly [number, number, number]; dim?: number }): DiffResult; // tolerance 0 default (any channel differs), dim 0.25
// forge
export type ForgeComparison =
  | { kind: 'opposite-mode' }
  | { kind: 'custom'; globals?: Readonly<Record<string, string>>; args?: Readonly<Record<string, unknown>>; dpr?: number };
export interface ResolvedConditions { globals: Globals; args: Readonly<Record<string, unknown>>; dpr: number | null }
export function resolveComparison(c: ForgeComparison | null, base: Globals, ctx: { declarations: GlobalDeclarations; modeGlobal: string; prefersDark: boolean; labMode: LabMode }): ResolvedConditions;
export function describeComparison(c: ForgeComparison, declarations: GlobalDeclarations): string; // "Opposite mode", "Theme: Ocean", "Arg size = 3", "DPR 2×"
// GlobalDeclaration
opposite?: (value: string, globals: Globals) => string | undefined;
```

`resolveComparison` resolves opposite mode when it renders, not when it is chosen, so a lens keeps showing the opposite after the lab's mode flips. It uses the declaration's `opposite`. Without one it swaps `light` and `dark`, resolving `auto` through `prefersDark` and `FOLLOW_APP` through `labMode`. A mode with neither gives a `describeComparison` of "Opposite mode: no opposite for '<value>'", and the lens shows the story unchanged. Swap attaches only the compared request. Split attaches the base request to the left rect and the compared one to the right, with `clip-path` from custom properties. Difference calls `capture()` on the Pixels source for both sides, even on a Live lens, and draws `diffPixels`. When Pixels is unavailable it shows that reason. `CompareMenu` (opened by `loupe.compare.menu`) lists each declared global's options, DPR 1/2/3, and every arg whose schema leaf is a boolean or has `options`.

- [ ] **Step 1: Write the failing tests**

```ts
it('splits the interior at the seam', () => { expect(splitRects({ x: 0, y: 0, w: 100, h: 50 }, 0.3).seamX).toBe(30); });
it('lights only differing pixels and dims the rest', () => { const r = diffPixels(a, b); expect(r.changed).toBe(1); expect(alphaAt(r.image, same)).toBeLessThan(255 * 0.3); });
it('throws on mismatched sizes', () => { expect(() => diffPixels(a, small)).toThrow(/size/); });
it('flips light to dark and resolves auto by the OS scheme', () => {});
it('keeps showing the opposite after the lab mode changes', () => {});
it('uses a declaration’s own opposite over the default swap', () => {});
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=labkit packages/labkit/src/loupe/lens/compare.test.ts packages/labkit/src/loupe/lens/difference.test.ts` and `npx vitest run --project=forge packages/forge/src/shell/loupe/conditions.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** `loupe.compare.opposite` sets `compare: { kind: 'opposite-mode' }` through `setLensOps`.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS. Take a headless screenshot of a Split lens in opposite mode on the forge app and send it with `transom post` (zone `weasel`).
- [ ] **Step 5: Commit** with the subject `add Swap, Split and Difference comparisons and an opposite-mode preset`.

### Task 11: Pixel grid and Contrast readouts

**Files:**
- Create: `packages/labkit/src/loupe/lens/pixelGrid.ts`, `packages/forge/src/shell/loupe/readouts.tsx`
- Modify: `packages/paint/src/contrast.ts`, `packages/paint/src/index.ts`, `packages/core/src/barrel/paint.ts` (re-export by name), `packages/labkit/src/loupe/lens/LensSlot.tsx`
- Test: `packages/paint/src/contrast.test.ts` (`weasel-ui`), `packages/labkit/src/loupe/lens/pixelGrid.test.ts` (`labkit`), `packages/forge/src/shell/loupe/readouts.test.tsx` (`forge`)

**Interfaces:**
- Produces:

```ts
// paint
export function contrastRatio(foreground: string, background: string): number | null; // WCAG 2.x relative luminance; null for a color it cannot parse
export function wcagLevels(ratio: number, largeText: boolean): { aa: boolean; aaa: boolean }; // 4.5/7, large 3/4.5
// labkit
export const GRID_MIN_FACTOR = 8;
export function softEdgeMask(img: ImageData, tolerance?: number): Uint8Array; // 1 where a pixel lies strictly between its opposite neighbors on either axis in every channel, by more than tolerance (default 8)
export function drawPixelGrid(ctx: CanvasRenderingContext2D, view: { factor: number; dpr: number; origin: LoupePoint }, mask: Uint8Array | null, colors: { line: string; tint: string }): void;
// forge
export function contrastAt(source: 'live' | 'pixels', at: { element?: Element; capture?: LensCapture; point: LoupePoint }): { ratio: number; aa: boolean; aaa: boolean; large: boolean } | { unavailable: string };
```

The grid draws only at `factor / dpr ≥ GRID_MIN_FACTOR` on a Pixels source. Otherwise its toggle shows "Grid needs Pixels at 8× and up". Contrast on Live takes the text element under the aim, its computed `color`, and the first opaque `background-color` up its ancestors, with `large` from computed font size and weight (≥ 24px, or ≥ 18.66px and weight ≥ 700). On Pixels it samples the capture at the aim, plus the most distant color in a 5×5 neighborhood.

- [ ] **Step 1: Write the failing tests**

```ts
it('gives 21 for black on white and 1 for a color on itself', () => { expect(contrastRatio('#000', '#fff')).toBeCloseTo(21, 5); expect(contrastRatio('#777', '#777')).toBe(1); });
it('passes AA but not AAA at 4.5', () => { expect(wcagLevels(4.5, false)).toEqual({ aa: true, aaa: false }); });
it('marks a blended pixel between two flat runs, and not the runs', () => {});
it('reports Contrast unavailable over an element with no text', () => {});
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=weasel-ui packages/paint/src/contrast.test.ts`, `npx vitest run --project=labkit packages/labkit/src/loupe/lens/pixelGrid.test.ts` and `npx vitest run --project=forge packages/forge/src/shell/loupe/readouts.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS. Also run `npm run test:smoke:consumer`, because core's barrel changed.
- [ ] **Step 5: Commit** with the subject `add Pixel grid and Contrast lens readouts and a WCAG contrast ratio in paint`.

### Task 12: The Token readout

**Files:**
- Create: `packages/forge/src/shell/loupe/tokenChain.ts`, `packages/forge/src/shell/cssVars/reveal.ts`
- Modify: `packages/svg/src/index.ts` (export `specificity`, `compareSpecificity` by name), `packages/forge/package.json` (depend on `@weasel-js/svg`), `packages/forge/src/shell/cssVars/CssVarsPanel.tsx` (subscribes to `reveal`: opens, scrolls to, and marks the row), `packages/forge/src/shell/loupe/readouts.tsx`
- Test: `packages/forge/src/shell/loupe/tokenChain.browser.test.tsx` (`browser`, because jsdom resolves no `var()`), `packages/forge/src/shell/cssVars/reveal.test.tsx` (`forge`)

**Interfaces:**
- Produces:

```ts
export interface ColorAt { element: Element; property: 'color' | 'background-color'; value: string /* computed */ }
export function colorAt(client: LoupePoint, within: HTMLElement): ColorAt | null; // text under the point (caretPositionFromPoint range rects) → 'color'; else first ancestor with opaque background → 'background-color'
export interface ChainLink { property: string; declared: string; selector: string; element: Element }
export function tokenChain(at: ColorAt): readonly ChainLink[]; // winning declaration for the property, then for each var() it names the winning declaration of that custom property on the element or nearest ancestor declaring it, until a value with no var()
export function revealVar(name: string): void;
export function subscribeReveal(fn: (name: string) => void): () => void;
```

The winning declaration is the matching style rule with the highest `specificity` (then the last in source order), with inline style above both, walking `document.styleSheets` and nested rules the way `cssVarUse.ts` walks them. The forge overrides rule counts like any other rule. The readout lists each link (`--wzl-accent ← --wzl-blue-500 ← #2563eb`), and clicking a `--wzl-*` link calls `revealVar` and turns the CSS vars panel on through its persisted `fg-css-vars-shown` record. A Pixels source with conditions changed reports "Token needs a Live source for changed conditions".

- [ ] **Step 1: Write the failing tests**

```tsx
it('follows background-color through two tokens to a literal', () => { expect(tokenChain(at).map((l) => l.property)).toEqual(['background-color', '--wzl-bg', '--wzl-gray-50']); });
it('takes the dark block’s declaration under data-wzl-mode="dark"', () => {});
it('takes a vars-panel override over the stylesheet', () => {});
it('opens the CSS vars panel at the token', async () => { revealVar('--wzl-bg'); expect(row('--wzl-bg')).toHaveAttribute('data-revealed'); });
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=browser packages/forge/src/shell/loupe/tokenChain.browser.test.tsx` and `npx vitest run --project=forge packages/forge/src/shell/cssVars/reveal.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS. Also run `npm run check:imports`.
- [ ] **Step 5: Commit** with the subject `add a Token lens readout that traces a color to its --wzl token chain`.

### Task 13: The key-bindings panel

**Files:**
- Create: `packages/forge/src/shell/keys/KeysPanel.tsx`, `packages/forge/src/shell/keys/keysChrome.ts`, `packages/forge/src/shell/keys/keys.css`
- Modify: `packages/forge/src/shell/Workshop.tsx`
- Test: `packages/forge/src/shell/keys/KeysPanel.test.tsx`

**Interfaces:**
- Consumes: `useActionsRegistry`, `actionShortcuts`, `actionBindings` from core, and `formatShortcut` from `@weasel-js/ui`.
- Produces:
  - `describeBinding(spec: GestureSpec): string` gives the chip text for key specs. For the rest it gives `"Wheel"`, `"Hover"`, `"Drag"`, `"Click"` and `"Hold <key>"`.
  - `KEYS_SECTION: LabContribution` (region `aside`, titled "Keys").
  - `KeysChrome({ onChrome })` mirrors `CssVarsChrome`, with the persisted lab record `fg-keys-shown`, a header toggle `fg-keys-toggle`, and an action `forge.keys.toggle` on `?`.
  - The panel lists `registry.list()` grouped by `group`, sorted by label, one row per action: label, then every binding's chip. It re-reads on `registry.subscribe`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('lists every lab action with its keys, the loupe’s included', () => { expect(row('Add lens')).toHaveTextContent('L'); expect(row('Magnify (loupe)')).toHaveTextContent('Wheel'); });
it('gives no two lab actions the same key', () => { /* collect key chips across registry.list() in a mounted Workshop with a lens up; expect no duplicates */ });
it('opens on ?', async () => {});
```

- [ ] **Step 2: Run to verify failure.** Run `npx vitest run --project=forge packages/forge/src/shell/keys/KeysPanel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement.** If the duplicate test finds a lens key that collides with an existing lab key, change the lens key in `lensActions.ts` and its row in Task 4's table, never the existing key.
- [ ] **Step 4: Run to verify the tests pass.** Expected: PASS.
- [ ] **Step 5: Commit** with the subject `add a forge panel listing every key binding the workshop registers`.

### Task 14: Docs, changeset, and the full run

**Files:**
- Modify: `packages/labkit/src/loupe/AGENTS.md` (a "Lenses" section: the three nodes, the Glass switch, the hit-box pass-through, the delete override, the source contract), `packages/forge/README.md` (a Loupe section: keys, sources, and the Playwright peer), `docs/superpowers/specs/2026-10-20-forge-loupe-design.md` (status line: first version built, with the date; Glass and the later readouts unbuilt), `docs/TODO.md` (one entry for Glass, one for leader-scope rebinding of lens keys, and one for "Delete on a Pinned lens goes through a lens-specific override" if Mike has not ruled on it)
- Create: `.changeset/forge-loupe.md` (`patch` for `@weasel-js/labkit`, `@weasel-js/forge`, `@weasel-js/paint`, `@weasel-js/svg`; the prose says it is additive)

- [ ] **Step 1: Write the docs.** Do a cut pass and show the cut list.
- [ ] **Step 2: Run the checks.** Run `npm run typecheck`, `npm run check:size`, `npm run check:frame-loops`, `npm run check:imports`, `npm run check:bumps` and `npm run test:gate`. Expected: all pass.
- [ ] **Step 3: Run the fleet.** Run `npm run test:fleet -- HEAD`. Expected: green, with a `fleet-tree: N changed path(s) match <sha>` line in the log. If a file the branch did not touch hits an OOM or a timeout, report it as contention.
- [ ] **Step 4: Delete this plan** (`git rm docs/superpowers/plans/2026-10-20-forge-loupe.md`).
- [ ] **Step 5: Commit** with the subject `document forge lenses and record what the first version leaves unbuilt`.

---

## Could not resolve

- **Delete on a Pinned lens (Spec correction 2).** The plan overrides the lens canvas's `delete` to expand to whole lenses. The alternative is a core change: have `moveSources` and `shapeSources` treat a node whose `derivePose` answers `null` as its own source. The reticle could then always depend on the body, and core's cascade would do the deleting. That is the cleaner engine answer, but it touches every derived node's drag. This is Mike's call before Task 3 Step 4.
- **Plain letter keys at lab level pre-empt a story's own keys while a lens is up.** `LabKeys` runs `keyboard: 'first'`, so a draw story's `v` or `r` tool keys go to the lens. Every lens key but `l` is disabled with no lens up, which narrows this without removing it. The leader-scope arc is the real fix. Until then, should the defaults carry a modifier?
