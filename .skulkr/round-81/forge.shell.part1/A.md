## Answer book evicts the answers of configs open trials still hold
- where: packages/forge/src/shell/answers.ts:46 (createAnswerBook record)
- scenario: two trials show the same story (one book per entry). Trial A sits on config X; in trial B the user drags a slider through 50+ values, and the frame records an answer for each config. The LRU drops the oldest key without consulting `held`, and reads (`answerFor`) never refresh recency, so X's answer is evicted while A still holds it. A's panel then treats X as unanswered: hidden controls reappear, disabled ones re-enable, errors vanish, until A's config changes and its frame records again. Eviction should skip held keys (or reads/holds should refresh them).
- evidence: read
- severity: medium

## Workshop's first render gives stories and the lab theme the declarations' defaults, with `App` unresolved
- where: packages/forge/src/shell/Workshop.tsx:172 (Workshop, labValues initial state)
- scenario: `labValues` starts as `labGlobals(declarations, undefined)` — no stored value, no chrome. With a stored lab choice of `dark`, or a `mode` declaration defaulting to `app`, the first commit hands every TrialHost/FrameView `StoryGlobalsContext` = the default (or literal `'app'`, which no story option or `setup.applyGlobals` understands) and `config.labTheme` is called with it. Only after `LabGlobals`' passive effect reports the persisted, App-resolved values does it flip, so stories and the lab theme flash the wrong mode (and frames receive an `init` with `'app'`). Should start from what `useLabGlobals` reads (stored values with `followApp`).
- evidence: read
- severity: low

## A story named "Index" loses its own breadcrumb step
- where: packages/forge/src/shell/breadcrumb.ts:22 (crumbs)
- scenario: the filter meant for `index` title segments also tests the story's own step (path null). A story exported as `Index` under `Comp/Button` gets crumbs `Comp › Button` with no "here" step — the same breadcrumb and trial title as the component's generated index page (INDEX_NAME = 'Index'), so the two trials/dialogs are indistinguishable and the last crumb is a folder link instead of the current story. Only title segments (path !== null) should be filtered.
- evidence: read
- severity: low

## Dossier redefines the `$globals` key instead of using GLOBALS_KEY
- where: packages/forge/src/shell/info/dossier.ts:41 (GLOBALS)
- scenario: the key forge appends pins under is defined in globals.ts (`GLOBALS_KEY`, and `FORGE_KEYS`/`isForgePath` for every forge-owned key); dossier keeps its own literal `'$globals'` and skips only that. Any change to the key or a further forge-owned schema group makes Get Info list the trial's pins as story args. One definition should answer it (`isForgePath`).
- evidence: read
- severity: low

## Host globals are not reapplied when `setup` changes
- where: packages/forge/src/shell/hostConditions.ts:57 (useHostConditions)
- scenario: `applyGlobalsTo(host, hostId, globals, latest.current.setup)` reads setup through `useLatest` and leaves it out of the deps, as does the overrides rule's `cssVarsScope`. When the Workshop's `setup` prop is replaced (a new frame config), in-document hosts keep the old setup's `applyGlobals` styling and override scope until globals or the host change. FrameView's copy path (FrameView.tsx:200) lists `setup` as a dependency of the same call, so the two paths answer differently.
- evidence: read
- severity: low

## Files read
packages/forge/src/shell/Crumbs.css
packages/forge/src/shell/Crumbs.tsx
packages/forge/src/shell/FrameView.tsx
packages/forge/src/shell/GlobalsToolbar.tsx
packages/forge/src/shell/IndexTrial.tsx
packages/forge/src/shell/RouteKnobs.tsx
packages/forge/src/shell/StoryBody.tsx
packages/forge/src/shell/StoryGlobalsContext.ts
packages/forge/src/shell/StoryScroller.tsx
packages/forge/src/shell/StoryTrial.tsx
packages/forge/src/shell/TrialHost.tsx
packages/forge/src/shell/Workshop.tsx
packages/forge/src/shell/a11y/A11yPanel.css
packages/forge/src/shell/a11y/A11yPanel.tsx
packages/forge/src/shell/a11y/reasons.ts
packages/forge/src/shell/answers.ts
packages/forge/src/shell/breadcrumb.ts
packages/forge/src/shell/checkShellConfig.ts
packages/forge/src/shell/dependencies.ts
packages/forge/src/shell/documentInstrument.tsx
packages/forge/src/shell/followEdits.ts
packages/forge/src/shell/frameActions.ts
packages/forge/src/shell/frameLink.ts
packages/forge/src/shell/framePool.ts
packages/forge/src/shell/globals.ts
packages/forge/src/shell/globalsMenu.tsx
packages/forge/src/shell/hostConditions.ts
packages/forge/src/shell/inViewMargin.ts
packages/forge/src/shell/index.ts
packages/forge/src/shell/info/StoryDossier.tsx
packages/forge/src/shell/info/StoryInfoDialog.tsx
packages/forge/src/shell/info/dossier.ts
packages/forge/src/shell/info/infoItem.ts
packages/forge/src/shell/instrumentCache.ts
packages/forge/src/shell/issues/IssuesPanel.tsx

<!-- done: 5 findings, files read: 35 -->
