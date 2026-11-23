Armed style read `italic: false` as absent, so Cmd+I in an upright run under an italic node did nothing (A): fixed cc73d05805. The root cause was in `@weasel-js/text`'s run model, which still treated italic as a flag where `false` means "no override", even though an earlier commit (a82e65b485) made a run's `italic: false` draw upright. So `styleAtRange`, `applyStyleToRange`, `effectiveRangeStyle` and the armed style now keep `false` apart from absent. `setFlagOverRange` now writes `italic: false` over just the range instead of rewriting the node; the old rewrite also turned upright runs outside the range italic. Tests that used italic as the node-rewrite example now use underline.

Pasted `pre-line` / `preserve-breaks` kept every space, because `\b` matched before the hyphen (A+B): fixed 99526a2dfc. Each white-space value now maps to how it treats spaces and line breaks, `preserve-spaces` included. B said the paste loses line breaks; that was wrong, since the regex matched and kept everything. The fix covers both.

A `container` change mid-edit threw away what was typed, with no commit and no `onEnd` (A): fixed 4f555b78bf. The open edit now moves to the new container with its text, selection, draft and held node style. Its undo history starts over there, which the changeset says.

`startEdit` with no container leaves an edit open that shows nothing and nothing ends (A): not a defect. Opening late when the container arrives is deliberate, and `useTextEdit.lifecycle.test.ts` tests it ("mounts the overlay when the container arrives after the edit started"). `cancelEdit` and `commitEdit` still end it.

A character typed at the start of a later run's text node took that run's style, while the published caret style named the run before it (B): fixed fb47cb2d29. That caret is now written through the runs, like a caret between two run spans.

The superscript and subscript toggles could never take off a node-level `script` (B): fixed 5229f1c78a. The toggle now reads the node's script. Taking it off rewrites the node the same way lowering a node flag does, through a new public `clearScriptOverRange` in `@weasel-js/text`, whose changeset is `minor` because it is new API.

No extra defects beyond the above.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: all pass (14 files, including the new `useTextEdit.uprightItalic`, `useTextEdit.nodeScript` and `useTextEdit.container` tests). Each new test failed before its fix; the two that also passed before are guards for the new behavior, not reproductions.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run check:changesets`: "[changesets] OK — 739 changeset(s)."
- `npm run lint -w <pkg>`: `text`, `text-dom` and `text-tools` have no lint script. The root `lint` passed inside the gate, and `npx eslint packages/text-dom/src packages/text/src/runs` was clean.
- No browser test files touched. Tree clean.

tally: 5 of 6 fixed, 0 extra fixed