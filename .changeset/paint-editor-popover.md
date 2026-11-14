---
'@weasel-js/ui': minor
---

`PaintEditorPopover` puts the whole paint editor in a popover under any trigger, the one `PaintField` and `FillStrokeSwatch` open.

Given `triggerRef`, `isOpen` and `onOpenChange` it opens under any element; inside a React Aria `DialogTrigger` it needs none of them. It takes `PaintInput`'s props. Render it through the `provide` of the opener's `useOverlayPortal`. Exported from `@weasel-js/ui/components/PaintField`.

<!-- entry: new api -->
