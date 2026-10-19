---
'@weasel-js/ui': patch
---

Two new entry points let a consumer reach the last root-only exports without importing the whole package: `@weasel-js/ui/components/Icon` exports `Icon`, `IconProps`, `isFillable`, `actionIcon`, `iconFromData`, `resolveIcon`, and the `UiIconName` type, and `@weasel-js/ui/paint-value` exports `solidColorOf`, `strokeColorOf`, and `isPaint`. The root barrel still exports what it did.
