---
'@weasel-js/ui': patch
---

A `Badge` can now trigger a kit tooltip. `Badge` forwards its `ref` and any other DOM attributes to its root element, so it works as the child of `Focusable` under a `TooltipTrigger`, and `@weasel-js/ui` now exports `Focusable` so that pattern needs no direct react-aria-components import. For the common case, `tooltip` does the wrapping itself: a badge that is neither a button nor a link becomes focusable as `role="img"`, named by `aria-label` or else by its string content, because a tooltip trigger has to be reachable by keyboard and announce its description.
