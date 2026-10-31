---
'@weasel-js/menu': patch
'@weasel-js/routing': patch
'@weasel-js/hud': patch
'@weasel-js/ui': patch
---

A menu item entry takes `radio: true`, and a menu draws it as a `menuitemradio` rather than a `menuitemcheckbox`. `resolveSchemaMenu` sets it on an enum's options, a union's variants and a field reference's choices, so screen readers hear them as one choice among several.
`CommandPalette` shows an action's own `shortcut` text when it has one, before falling back to its bindings as keycaps.
A `Dialog` in a contained portal opens from an enclosing `<DialogTrigger>` when it is given no `isOpen`.
`CurveEditor` takes an `aria-label` and names its plot with it.
A `Callout` keeps a `style` it is given alongside its stance, grade and tint, rather than losing it to them.
`Callout`, `LastOperationPanel` and `DragGhost` draw their shadow from `--wzl-bevel-raised` when a theme sets it, as `Dialog` and the menu popovers do.
`Button`'s busy spinner stops turning under `prefers-reduced-motion: reduce`.
Breaking: `BarPopover`'s `isDisabled` prop is now `disabled`, as every other Bar part names it.
