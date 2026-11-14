---
'@weasel-js/hud': major
---

The HUD menu takes its row heights, padding, columns, and font size from the theme, as the DOM context menu does.

Its panels are now measured by `@weasel-js/ui-logic`'s `measureMenuPanel` in the HUD's resolved theme, so in the
built-in theme its text is 15px rather than 13px and a row's label starts after a 16px icon column. The
`DEFAULT_MENU_METRICS` constant, the `MenuMetrics` type, and `createMenuWidget`'s `metrics` option are gone: set the
theme's tokens instead.

```ts
// before
createMenuWidget({ ...opts, metrics: { ...DEFAULT_MENU_METRICS, rowHeight: 28 } });
// after: a theme whose --wzl-control-h-sm is 28px
```

<!-- entry: breaking visual -->
