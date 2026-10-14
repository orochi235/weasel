---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

labkit's `LabSwitcher` is a `MenuButton`, so its menu wears the popover skin `MenuButton`, `Select`, and `ComboBox` share and its own copy of that skin is gone. Breaking for a host that styled it: the `lk-switcher`, `lk-switcher-trigger`, `lk-switcher-caret`, `lk-switcher-menu`, and `lk-switcher-item` classes no longer exist, a `className` lands on the `<h1>`, and the menu renders in the overlay portal instead of under the title.

Additive in `@weasel-js/ui`: a `MenuButton` row takes `href`, which makes it a link, and `isCurrent`, which marks it `aria-current="page"` and draws it bold; `bare` draws the trigger as its label and a caret in the type around it, with no field frame; and `onAction` is optional.
