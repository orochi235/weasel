---
"@weasel-js/labkit": patch
---

`<Lab hide>` drops a trial button and keeps its shortcut: `hide={['undo', 'redo']}` takes away the undo row while Mod+Z still steps the trial.

`suppress` still drops both. Like it, `hide` throws on an id that is not there.

<!-- entry: new api -->
