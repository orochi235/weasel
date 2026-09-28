---
'@weasel-js/core': patch
---

`useSelection` now returns the same object for the life of the component. A memo or effect keyed on `selection` used to rerun every render, so tools built from it were rebuilt every render, and with `onToolsCreated={setTools}` that looped ("Maximum update depth exceeded"). `current` still reads the live selection and the calling component still re-renders when it changes, but anything derived from the ids must now be keyed on `selection.current`, not `selection`: a memo keyed only on the api no longer reruns when the selection changes. A changed `mode` or `extend` takes effect without a new object.
