---
'@weasel-js/theme': minor
---

Scrollbars are quiet by default, a faint thin thumb on no track, chosen by a new `scrollbars` theme axis.

`scrollbars: 'native'` (through `applyTheme`, or `axis.scrollbars` in Prefs) leaves them to the platform; win9x and mac-classic default to it. Two tokens drive it, `--wzl-scrollbar-color` and `--wzl-scrollbar-width`, and either can be pinned. `tokens.css` applies them at no specificity, so a class setting `scrollbar-color` or `scrollbar-width` on a scroller still wins. A theme defining neither token leaves scrollbars alone.

```ts
applyTheme(root, weaselTheme, { scrollbars: 'native' });
```

<!-- entry: rank=10 new visual api -->
