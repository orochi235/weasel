---
'@weasel-js/menu': major
'@weasel-js/routing': major
'@weasel-js/ui': major
'@weasel-js/hud': major
---

A menu row built from an action shows the action's or variant's declared `shortcut` text, as the palette and bars already did.

`MenuItemEntry.shortcut` is `MenuShortcut | string`: a string is printed as written. Code that formats it has to handle both.

```ts
// before
formatShortcut(entry.shortcut);
// after
typeof entry.shortcut === 'string' ? entry.shortcut : formatShortcut(entry.shortcut);
```

<!-- entry: breaking fix -->
