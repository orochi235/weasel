---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A color-mode choice with a way back to Auto, as kit surface instead of something each app rebuilds.

`@weasel-js/theme` exports the `ColorModePreference` type (`'auto' | 'light' | 'dark'`), `ColorMode` (`'light' | 'dark'`) and `isColorModePreference`. `@weasel-js/theme/react` adds `useResolvedColorMode(preference)`, which follows the OS setting live under `'auto'` and returns an explicit choice as given, and `useColorModePreference({ storageKey, storage, defaultPreference })`, which holds the choice, optionally remembers it in `localStorage` (or a store you pass), and returns `{ preference, setPreference, mode }`. `mode` is what goes in a `ThemeProvider`'s `selection`. Storage that is missing or throws leaves the choice unremembered rather than failing.

`@weasel-js/ui` adds `ColorModeControl`, the Auto / Light / Dark radiogroup drawn with the mode glyphs, controlled by `value` and `onChange`.

labkit's header now renders `ColorModeControl`, and `<Lab>` and `<LabRoot>` resolve their mode with `useResolvedColorMode`; `LabMode` is an alias of `ColorModePreference`. Switching a lab back to Auto now picks up an OS change made while it was pinned.
