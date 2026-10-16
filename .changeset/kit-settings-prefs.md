---
'@weasel-js/prefs': patch
---

A prefs schema can now reach CSS without a store, and a store can drive the kit's settings. `prefsDefaultsSource(schema)` reads a schema's defaults the way a store at defaults does, so `prefsCss(prefsDefaultsSource(schema))` writes its stylesheet. The new `@weasel-js/prefs/vite` entry exports `weaselPrefsCss({ schemas, css })`, a Vite plugin that serves that sheet for each named schema as `virtual:weasel-prefs.css` and rewrites it when a schema or anything it imports changes; `vite` is an optional peer. `<KitSettingsFromPrefs store at css>` in `@weasel-js/prefs/react` feeds a store's values to `KitSettingsProvider` from `@weasel-js/react`, now a dependency, and with `css` adopts them as `--wzl-kit-*` custom properties into the document or shadow root it renders in, named by `kitSettingsCssOptions(at)`. `prefsCss` with `root: ':host'` now matches its attributes as `:host([…])`, which a shadow root's sheet needs. Additive.
