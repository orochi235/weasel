---
'@weasel-js/core': patch
---

Adds `createGroupEntryContribution` and `useGroupEntryContribution` (with `GROUP_ENTRY_ID` and the `EnterGroupOptions`, `LeaveGroupOptions` and `PressTargetTree` types) to the public API: the double-click-to-enter and Escape-to-leave bindings `<SceneCanvas>` installs, for a host that mounts the dispatcher and tools itself. This adds API.
