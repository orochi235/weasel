---
'@weasel-js/labkit': patch
---

Fixes: every trial in a lab re-rendered whenever any trial's record changed: a pan frame, a job item, a clock write, or a mark save in one trial rendered them all, chrome included. `Trial` and `TrialChrome` read `LabContext`, whose value carries `trials`. A trial now renders for its own record alone.

Adds API, on an agent's judgment: `useLabCommands()`, with `LabCommands` and `LabCommandsContext`. It is the surrounding lab without `trials`, in a value that does not change when a record does, for a component that should not render then; read a trial through the store. `useLabContext()` and `LabContext` are unchanged and still carry `trials`. Under a bare `LabContext.Provider`, `useLabCommands()` reads that.

`TrialChrome` no longer falls back to the first trial when `focusedTrialId` is null, which `LabContextValue` says it is only when there are no trials.
