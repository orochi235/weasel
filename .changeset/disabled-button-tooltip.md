---
'@weasel-js/ui': patch
---

A disabled button keeps its tooltip. `Button`, `ButtonBar` and `ToggleBar` items, `MenuButton`, `ToolButton`, `CloseButton` and bar action buttons now stay hoverable and focusable while disabled, marked `aria-disabled` rather than `disabled`, and ignore presses (a disabled submit button submits nothing). A new `disabledReason` prop on each makes the tooltip read `Name: reason` and gives the reason to assistive tech as the button's description. A disabled button with no tooltip at all is still natively disabled. A test that checks such a button with `toBeDisabled()` now wants `toHaveAttribute('aria-disabled', 'true')`.
