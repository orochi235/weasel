---
'@weasel-js/ui': patch
---

Changes behavior: unmounting `SceneGradientHandles` while a handle is held cancels the drag. It committed the paint under the pointer as an undo entry, then opened and canceled a second edit at the starting value. A drag cut short by an unmount now ends the way one cut short by `pointercancel` does. Decided on an agent's judgment; `useOngoingAction` itself still commits an edit left open at unmount, which is right for a slider left mid-edit.
