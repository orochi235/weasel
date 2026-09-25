---
'@weasel-js/forge': patch
'@weasel-js/theme': patch
---

forge's CSS Vars panel can save its scale edits into the theme's definition file. "Save scales to theme" writes each edited scale back through its references: a font base read from `{seeds.ui-base}` changes that seed for the trial's density only, so the other densities keep theirs, and a param that differs by axis changes only the branch the trial shows. A save that would have to flatten a reference, or guess an axis value (a `mode` of Auto), is refused with a message. The write goes to the dev server's `__theme/<name>` endpoint with the file's hash, so a file changed on disk is reported rather than overwritten; once saved, the trial's overrides for those scales are dropped, since the theme now carries them.

`@weasel-js/theme/engine` now exports the theme store's protocol — `StoredTheme`, `PutResult`, `IssueReport`, `serializeDefinition` — and `httpThemeApi`, its client, which the theme editor and forge both use.
