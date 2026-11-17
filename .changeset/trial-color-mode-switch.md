---
'@weasel-js/labkit': minor
---

A trial drawn in DOM gets its own color-mode switch beside Undo and Redo, so its content can sit in Light or Dark apart from the lab.

The switch is the `mode` contribution, offered to an instrument that declares no `canvas` or `stage`; `hide={['mode']}` or `suppress={['mode']}` removes it. Auto follows the lab. The content is wrapped in a `ThemeProvider` set to the trial's mode, so `useThemeOptional()` inside an instrument reads it; the lab's header and the trial's chrome keep the lab's mode. The choice is saved on the trial record as `colorMode`, kept by Clone, Reset and swapping the instrument, and `TrialChromeContext` carries `colorMode` and `setColorMode`.

<!-- entry: rank=5 new api data -->
