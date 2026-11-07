---
'@weasel-js/ui': patch
---

A disabled button can say why. `Button`, `ButtonBar` and `ToggleBar` items, `MenuButton`, `ToolButton` and `CloseButton` take a `disabledReason`. Given one, a disabled button keeps its tooltip, which reads `Name: reason`, stays hoverable and focusable (marked `aria-disabled` rather than `disabled`), ignores presses (a disabled submit button submits nothing), and gives the reason to assistive tech as its description. Without one, a disabled button is natively disabled with no tooltip, as before. Bar action buttons already worked this way and now share the same path.
