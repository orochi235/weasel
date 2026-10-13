---
'@weasel-js/ui': patch
---

ui: `CommandPalette` and `CommandPaletteProps`. A dialog that lists every action registered with the surrounding `<ActionsProvider>`, filters by label, shows each one's shortcuts and why a disabled one is disabled, and runs the chosen one through the registry. It was the demo site's own component; the site and WeaselDraw now both import it. The host opens it: pass `open` and `onClose`.
