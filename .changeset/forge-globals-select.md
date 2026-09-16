---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

labkit re-exports weasel-ui's `Select` and `SelectProps`, beside the other ui
controls it passes through. forge's header globals (Mode, Font, Weight, Width,
Italic) now use it in place of native selects, each sized to its widest option.
