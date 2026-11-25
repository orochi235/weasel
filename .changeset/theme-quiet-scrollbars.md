---
'@weasel-js/theme': minor
---

Scrollbars are quiet by default: a faint thin thumb on no track, set by two new theme tokens.

`--wzl-scrollbar-color` and `--wzl-scrollbar-width` drive every scroller, and both are prefs; pin them to `auto` for the platform's own scrollbars. `tokens.css` applies them at no specificity, so a class setting `scrollbar-color` or `scrollbar-width` on a scroller still wins. A theme defining neither token leaves scrollbars alone.

```ts
defineTheme({
  name: 'mine',
  extends: weaselTheme,
  pins: { 'scrollbar-color': { value: 'auto', type: 'string' }, 'scrollbar-width': { value: 'auto', type: 'string' } },
});
```

<!-- entry: rank=10 new visual api -->
