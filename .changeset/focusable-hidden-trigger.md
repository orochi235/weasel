---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`Focusable` is now the kit's own, built on React Aria's `useFocusable`, and every kit tooltip on a native element goes through it. React Aria's `<Focusable>` warned "child must be focusable" for a trigger that mounted hidden — in a collapsed box, or a story still mounting — because its check asks whether the element is visible. The kit's check reads the element's markup alone, so a hidden native button no longer warns, while a child that can never take focus, or has no interactive role, still does. `@weasel-js/ui` now depends on `react-aria` directly.
