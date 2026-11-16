---
'@weasel-js/core': major
'@weasel-js/editing': minor
---

The group enter and leave actions, `createEnterGroupAction` and `createLeaveGroupAction`, move to `@weasel-js/editing`.

This is breaking: import them and their `EnterGroupOptions` and `LeaveGroupOptions` from `@weasel-js/editing`, beside the group-entry contribution that binds them. Core now exports `isEnterable`, which says whether a node is a group a press can enter, and the `AdapterPickGates` and `PickSource` types its pick helpers already took.

<!-- entry: rank=20 breaking api -->
