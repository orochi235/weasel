# Audit 29 — labs (reviewer B)

## A lab-wide `suppress`/`hide` of the new `mode` or `copy-settings` built-in throws on any trial whose instrument lacks it
- where: packages/labkit/src/chrome/builtins.tsx:108 (TRANSIENT_BUILTINS), :246 (MODE_SWITCH push); packages/labkit/src/chrome/trialActions.tsx:62 (copy-settings); packages/labkit/src/chrome/merge.ts:46 (suppressContributions)
- scenario: `<Lab suppress={['mode']}>` (or `hide={['mode']}`) with one DOM instrument and one canvas instrument. `mode` is only contributed when `drawsDom(instrument)`, and `copy-settings` only when the schema has children, but neither id is in `TRANSIENT_BUILTINS`, so `suppressContributions` throws `cannot suppress "mode": no contribution with that id` for the canvas trial (and for a trial swapped onto a canvas instrument later). `<Lab>`'s `suppress`/`hide` apply to every trial (README "Contributions passed to `<Lab>` apply to every trial"), so the only way to drop the mode switch from DOM trials is a crash in the others. `fps`, which is likewise per-instrument (canvas only), is listed transient for exactly this reason; `settings` has the same gap for an instrument with no settings.
- evidence: read
- severity: medium

## "Copy settings as JSON" copies the raw stored config, not what the trial runs with: auto leaves come out at their stale pinned value
- where: packages/labkit/src/chrome/trialActions.tsx:70 (copy-settings onActivate) via :10 (settingsConfig); ctx.config set at packages/labkit/src/trial/TrialChrome.tsx (ctx memo, `config: record.config`)
- scenario: an instrument with a leaf declared `.initial(auto)` (or one the user set back to Auto) whose resolver computes 12 while `record.config` still holds the default/last pinned 10. The Settings panel shows the auto value (it gets `auto` and `reported` alongside), the instrument reads `resolveAutoConfig(...)` = 12, but Copy settings serializes `record.config` and writes `10`, with nothing marking the path as auto. Pasting that JSON as a trial's `config` seed pins 10. TrialChrome already computes the resolved config (`settled`) and does not use it here.
- evidence: read
- severity: low

## The lab's chord actions also match by physical `code`, so on QWERTZ one keystroke matches both Undo and Redo, and on Dvorak Mod+O saves a snapshot
- where: packages/labkit/src/lab/labChords.ts:42 (keySpec), used at :90-99
- scenario: `keySpec` gives every chord `code: \`Key${key.toUpperCase()}\``, and the gesture matcher accepts a key spec when *either* `code` or `key` matches (`matchKeyOrCode`, packages/gestures/src/ui/match.ts:96). On a German QWERTZ layout the key labeled Z has `code: 'KeyY'` and the one labeled Y has `code: 'KeyZ'`, so Ctrl/Cmd+Z (key `z`, code `KeyY`) matches `lab.undo` by key and `lab.redo`'s Mod+Y binding by code, and Ctrl+Y matches both the other way round; whichever ranks first, one of the two keystrokes runs the wrong step (and with nothing to undo, Mod+Z can fall through to redo). On Dvorak, the `KeyS` position types `o`, so Ctrl+O (and on AZERTY-like layouts other letters) runs `lab.snapshot` and swallows the browser's own shortcut. The document listeners this replaced matched through `historyKey`/`matchKeyEvent` by what the key typed, with `chordKey` already covering non-Latin layouts, so the `code` field is redundant where it helps and wrong where layouts swap letters.
- evidence: read
- severity: medium

## A record another tab writes is taken with less checking than the same record read at open: a non-object `layout`/`undock` lands in the store as is
- where: packages/labkit/src/state/bindLabStore.ts:222 and :225 (remote `layout` / `undock` cases), :81 (remoteTrial's object check); compare packages/labkit/src/state/document.ts normalizeDocument (`isPlainObject(doc.layout) ? doc.layout : {}`) and packages/labkit/src/state/labRecords.ts documentOfRecords (`isObject(value)` for trial records)
- scenario: a second tab (or a different labkit build sharing the storage key) writes the `layout` record as a list, a string or a number. On open, `normalizeDocument` would start it empty (the 2026-11-10 ruling: "A stored layout or undocked-panels record that is not a plain object, a list included, starts empty"); arriving as a remote change, `patch.layout = value ?? {}` puts the list straight into `state.layout`, and the same for `undockedPanels`. Likewise a remote trial record that is an array passes `typeof value === 'object'` and is hydrated, where `documentOfRecords` would skip it with `isPlainObject`. One decision, answered two ways depending on whether the record arrived at open or live.
- evidence: read
- severity: low

## Two story files sharing a story id now crash the whole workshop, though forge's new warning says "the workshop shows only the first"
- where: packages/forge/src/vite/titleReport.ts (warnShared message); packages/forge/src/shell/useStoryRegistry.ts:218 (one instrument per index entry, `name: entry.id` in storyInstrument.tsx:37 / documentInstrument.tsx:36); packages/labkit/src/state/store.ts hooksOf → assertUniqueNames (added the same day, f676c39b43), reached from `setInstruments` in packages/labkit/src/lab/Lab.tsx
- scenario: `a.stories.tsx` and `b.stories.tsx` both titled `Ui/Button` and both exporting `Primary`. The forge plugin logs "story id ui-button--primary is declared by a.stories.tsx, b.stories.tsx; the workshop shows only the first". But the Workshop passes the index unchanged to `useStoryRegistry`, which builds one instrument per entry named by its id, so the instrument list holds two instruments named `ui-button--primary`, and labkit's new `assertUniqueNames` throws `labkit: two instruments are named "ui-button--primary"` when the Lab sets its instruments: every story is unreachable, not just the second. Either the workshop should drop the later duplicate entries (as its message promises) or the message is wrong.
- evidence: read
- severity: medium

## forge's per-trial frame scroll table is never pruned, and a new frame in the same trial reads the old frame's scroll
- where: packages/forge/src/shell/loupe/frameScroll.ts:12 (`frames` module Map), :20 reportFrameScroll, :27 scrollOf
- scenario: every isolated story trial whose frame reports a `scroll` adds an entry keyed by trial id; nothing in forge deletes one (no `frames.delete` anywhere; closing a trial, swapping it to another story via the frame's `open` message, which mints a new trial id, or the workshop unmounting all leave entries behind). A long workshop session grows the table by one entry per trial ever scrolled. And while a trial keeps its id but its frame reloads (an edit reloading the story, or a reconnect), `scrollOf(host)` keeps answering the dead document's last position until the new frame scrolls, so a loupe capture (capturePayload) and FrameView read a scroll offset the page no longer has. A host without `data-fg-host` falls to the shared key `''`.
- evidence: read
- severity: low

## forge passes Storybook control bounds straight into `f.number().range()`, which now throws, so one odd argType fails every story in its file
- where: packages/forge/src/csf/argsToSchema.ts:168 (bounded) → packages/labkit/src/config/numberNode.ts range/checkedBounds (throwing since 8753bc430b, 2026-11-16); called per export from packages/forge/src/csf/loadCsfModule.tsx:171 with no per-story guard
- scenario: a CSF file with `argTypes: { size: { control: { type: 'range', min: 0, max: Infinity } } }`, or bounds computed to NaN, or written reversed (`min: 100, max: 0`). Storybook renders that control; forge's `bounded` calls `.range(min, max)`, labkit throws `f.number().range() was given Infinity`, the throw escapes `argsToSchema` and the loader's loop, and `useStoryRegistry.request` faults every story in the file (`fail(ids, …)`), not just the one export. argsToSchema already degrades other unreadable argTypes to "no control" (returns null) rather than failing the load; bounds are the one input that now takes the file down.
- evidence: read
- severity: low

## The forge app's `followScheme` keeps every story host it ever themed, detached subtree and all, until the OS color scheme next changes
- where: apps/forge/mode.ts:20 (`last` Map in followScheme), :23-27 (the only pruning, inside the watchColorScheme callback); used by apps/forge/forge.frame.tsx `applyGlobals`, which the workshop applies to every in-document story host
- scenario: in the workshop's document mode each opened story gets its own host root, and every `applyGlobals` call does `last.set(target.root, …)`. A host that unmounts (trial closed, story switched, Clone/Reset remounting, an HMR reload) is deleted from `last` only when `watchColorScheme` fires, i.e. when the OS flips light/dark, which may never happen in a session. Until then the Map strongly holds each detached root element, with its whole rendered subtree, plus its globals and target (whose `style` closure holds the host's style element). Browsing a few hundred stories retains a few hundred dead DOM trees. Pruning on each `applyGlobals` call (dropping disconnected roots) or keying with a WeakMap plus a live set would bound it.
- evidence: read
- severity: low

## The lab's chord and transport keys take the nearest `[data-trial-id]` as their trial even when it belongs to another lab, so a lab nested in a trial steers the outer lab's keys
- where: packages/labkit/src/lab/labChords.ts:50 (ownerNow); packages/labkit/src/clock/useTransportKeys.ts:110 (trialOf) / :116 (answersFor); compare packages/labkit/src/lab/useFocusPick.ts (walks out past trials the lab does not own: "A trial can hold a lab of its own")
- scenario: a `<Lab>` rendered inside another lab's trial, which forge's workshop does for every labkit story in document mode. Focus sits in the inner lab's own chrome (its header, its Add-trial menu, its settings rail), outside any inner trial. The inner lab's `ownerNow` finds the *outer* trial's id via `closest('[data-trial-id]')`, has no claim for it, and does nothing; the outer lab's `ownerNow` finds that same outer trial and runs its Undo/Redo/snapshot, so Mod+Z typed in the inner lab steps the story trial's history around it. Conversely, with focus inside an inner trial, the outer lab reads an id it does not own and falls back to nothing, which is right only by accident. `useFocusPick` already filters the walk to trials the lab's store owns; these two key paths answer the same "which trial is this key for" question without that filter.
- evidence: read
- severity: low

## labkit's camera and mark-store registries stack registrants by design but are not `layered`, so their intended use draws registry clash warnings in development
- where: packages/labkit/src/canvas/cameraRegistry.ts:23 (`createReflectable({ name: 'cameras' })`), :45 usePublishCamera; packages/labkit/src/annotations/labMarkStores.ts:22 (`{ name: 'mark stores' }`); warning in packages/registry/src/reflectable.ts push (`!layered && !under.fallback && under.value !== value && same rank`)
- scenario: a trial with two camera views (the case `usePublishCamera` exists for: "a registry key stacks newest-live, so the camera last used is the one chrome reaches"). Camera B publishes over camera A under the trial id, and every time A's scope becomes active again it releases and re-pushes over B. Each push is over a live, non-fallback registrant of the same rank holding a different value, so the registry (clash warnings added 2026-11-16, ee1de4497e/eef09e18c1) logs `weasel cameras: an unnamed registrant registered "<trial id>" over an unnamed registrant, which is not an engine default…` in development for an arrangement labkit documents as correct. The mark-store registry, rebuilt the same day to stack per trial "newest live", has the same shape. `createReflectable` grew `layered` for exactly this (actions and dep sources pass it); these two registries do not.
- evidence: read
- severity: low

## The Pixels contrast readout never handles a rejected capture: the readout keeps the previous point's reading and the rejection goes unhandled
- where: packages/forge/src/shell/loupe/readouts.tsx:150-156 (the `kind === 'pixels'` effect: `void capture(request).then(...)` with no rejection handler)
- scenario: the Pixels source's `capture` awaits `client.take(...)`, a fetch to the dev server's capture endpoint, which rejects when the server goes away or the request fails at the network level. LensSlot's Difference view treats that as expected (`.catch((err) => say(messageOf(err)))`), and pixelsLens catches it too (`Capture failed: …`). The contrast readout does not: `setPixels` is never called, so the readout goes on showing the contrast measured at the reticle's previous position as though it were current, and the rejection surfaces as an unhandled promise rejection on every reticle move.
- evidence: read
- severity: low

## Two story titles that differ only in case or punctuation get one index-page id, which now crashes the workshop with no warning
- where: packages/forge/src/story/indexPages.ts:10 (indexId = sanitize(title) + ':index') and :52 (indexEntries groups by the raw `title`); packages/forge/src/shell/Workshop.tsx (`entries = [...index, ...indexEntries(index)]`, one instrument each, `name: entry.id`); labkit's assertUniqueNames in packages/labkit/src/state/store.ts
- scenario: one file titled `labkit/Lab` and another `Labkit/Lab` (or `ui/Color Field` and `ui/Color-Field`), with different export names so no story id repeats. `indexEntries` keys its map by the unsanitized title, so it emits two index entries, but both get the id `labkit-lab:index`. The workshop builds an instrument per entry named by id, and labkit throws `two instruments are named "labkit-lab:index"` the moment the Lab receives the list, so no story opens. The plugin's new duplicate check (`warnShared`) runs over story entries only, so nothing names the cause. Grouping index pages by `sanitize(title)` (or by the id) would give one page for both, matching how their story ids already merge.
- evidence: read
- severity: medium

## A trial's stored `colorMode` is used without the check the lab's own stored mode gets
- where: packages/labkit/src/trial/TrialChrome.tsx (`<TrialTheme mode={… record.colorMode ?? 'auto' …}>`, ctx `colorMode`); packages/labkit/src/trial/TrialTheme.tsx:20; stored records pass through packages/labkit/src/state/helpers.ts deserializeTrials and bindLabStore remoteTrial untouched; compare packages/labkit/src/state/document.ts normalizeDocument / bindLabStore meta case (`mode === 'light' || 'dark' || 'auto'` else fallback)
- scenario: a trial record whose `colorMode` is anything but `light`/`dark` (a hand-edited or older/newer stored record, another tab's build, or the old `'interstellar'` name the lab-level migration maps to `dark`). The lab's mode is coerced to a known value on every read path; the trial's is handed straight to `ThemeProvider` as `selection.mode` and to the `mode` CycleButton as its value, so the trial's content gets a mode the theme does not declare (applyTheme warns and the content falls back to whatever the theme does with an unknown axis value) and the switch shows no option selected. `isColorModePreference` exists in @weasel-js/theme for exactly this check.
- evidence: read
- severity: low

<!-- done: 13 findings, files read: 46 -->
