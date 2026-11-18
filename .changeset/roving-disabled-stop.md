---
'@weasel-js/ui': minor
---

`useRovingTabIndex` takes `disabled: 'stop'`, so its arrow keys land on an `aria-disabled` item and focus shows its reason.

That suits a menu, a listbox or a tab list. The default, `'skip'`, passes over it as before, which suits a toolbar. A natively `disabled` item takes no focus either way.

<!-- entry: api -->
