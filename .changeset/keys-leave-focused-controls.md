---
"@weasel-js/routing": patch
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

A canvas no longer claims Space or Enter when focus is on a control those keys activate — a button, a link, a checkbox — so a mounted canvas stops canceling a focused button's activation with its held-Space pan. Other shortcuts still reach the canvas from a focused button. The test is exported as `activatesFocusedControl`, beside `isEditableTarget`.

`DiagramView` takes `enableKeybindings`, and a view-only diagram (no `onMove` or `onConnect`) now defaults it off, so it no longer takes held Space from the rest of the page. Pass `enableKeybindings` to keep a view-only diagram's keys on.
