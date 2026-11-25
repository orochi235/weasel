---
'@weasel-js/gestures': patch
---

`isEditableTarget` sees a text field focused inside an open shadow root when handed its host, so `undoKeyStep` and the dispatcher's key routing leave Cmd+Z and typed keys to a field in a web component.

<!-- entry: fix -->
