# @weasel-js/ui

UI chrome primitives for weasel apps (properties panel, etc.)

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/ui).

## Install

```sh
npm install @weasel-js/ui
```

## Usage

```tsx
import '@weasel-js/theme/tokens.css';
import '@weasel-js/ui/style.css';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';

export function SnapControls({ snap, setSnap }: { snap: boolean; setSnap: (on: boolean) => void }) {
  return (
    <>
      <Button onClick={() => setSnap(false)}>Reset</Button>
      <Checkbox isSelected={snap} onChange={setSnap}>Snap</Checkbox>
    </>
  );
}
```

Both stylesheets are required: component styles ship as one bundled file, and read the design tokens
`@weasel-js/theme/tokens.css` declares. Each component has an entry of its own or of its family,
`@weasel-js/ui/components/<Name>`, so a bundle holds only the ones it imports; the main entry re-exports them all. A
family shares one: `PrefsForm` and `PrefsDialog` come from `components/Prefs`, and `PropertyPanel`, `PropertyField`
and `PropertyRow` from `components/Properties`.

Components that draw glyphs (`Transport`'s play and pause buttons, `COLOR_MODE_OPTIONS`, the paint and stroke rows of
`SelectionPanel`, tool palettes) look them up by name in the icon registry. Mount one at the app's root; `kitIcons`
holds core's, the shapes' and ui's tables (`@weasel-js/ui/icons` has ui's alone):

```tsx
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';

<IconRegistryProvider icons={kitIcons}><App /></IconRegistryProvider>
```

In development a glyph left unregistered draws a question mark and warns once in the console. The build plugin that
trims the tables to the glyphs an app uses is in
[icons](https://github.com/orochi235/weasel/blob/main/docs/icons.md).

A `Slider` or `BandEditor` that maps values onto its track non-linearly takes a
scale from `@weasel-js/plot/scales`: `<Slider scale={logScale} … />`. `Plot2D`'s
generated ticks and the `Timeline` ruler's come from the same scales, and a
custom `TickSettings.format` receives their `TickFormatCtx`.

## Numbers in the user's locale

Number fields show and read numbers in one locale: `2,5` and `1.500` in German. That covers `UnitField`, `NumberField`,
the number rows of `PrefsForm`, `PropertyPanel` and `SelectionPanel`, and the context menu's number rows. The locale
is the nearest `I18nProvider`'s, else the browser's language, else `en-US`, so one provider sets them all:

```tsx
import { I18nProvider } from '@weasel-js/ui';

<I18nProvider locale={userLocale}>
  <App />
</I18nProvider>
```

Take `I18nProvider` from `@weasel-js/ui`, not from a `react-aria-components` of your own: a second copy of React Aria
keeps a locale the fields never see. `UnitField`'s `locale` prop sets one field alone, and `useFieldLocale(locale?)`
returns the locale a field settles on, for a field of your own. A locale whose numbers would not read back as shown
falls back to Latin digits, then to `en-US`.

## License

MIT
