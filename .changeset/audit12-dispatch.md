---
'@weasel-js/routing': patch
---

Fixes to how the gesture dispatcher ends held keys, carries and pointer sessions, and to which surface keeps the keys.

- A key held over one view and released over another, or released by the window losing focus, ends its action with the context of the view that took the keydown (its `viewId` and that view's deps), not the view under the pointer.
- A carry (`startCarry`) is canceled when the window loses focus, as the dispatcher's own drags are. Before, its next move after focus came back, with no button held, was read as a release and dropped the carry wherever the pointer then was.
- A pointer session whose origin element leaves the document mid-drag cancels with `'lostcapture'` in Chrome, which sends `lostpointercapture` to the document rather than to the removed element. Before, the drag stayed live and committed on the release.
- A press, wheel or right-click on a dispatcher mounted with `keyboard: false` (labkit's `FollowDispatch`, a sweeping `ToggleBar` or `OptionsBar`, `TrialOverview`) no longer takes the keys from the canvas that holds them. `ActionsRegistry.activate` takes `{ keys: false }` for this.
