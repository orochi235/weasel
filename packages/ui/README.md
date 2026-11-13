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

export function Toolbar({ snap, setSnap }: { snap: boolean; setSnap: (on: boolean) => void }) {
  return (
    <>
      <Button onClick={() => setSnap(false)}>Reset</Button>
      <Checkbox isSelected={snap} onChange={setSnap}>Snap</Checkbox>
    </>
  );
}
```

Both stylesheets are required: component styles ship as one bundled file, and read the design tokens
`@weasel-js/theme/tokens.css` declares.

Components that draw a glyph (`Transport`'s play and pause buttons, among others) read it from an icon
registry, and draw nothing without one. Mount one at the app's root:

```tsx
import { IconRegistryProvider } from '@weasel-js/core';
import { kitIcons } from '@weasel-js/ui/kit-icons';

<IconRegistryProvider icons={kitIcons}><App /></IconRegistryProvider>
```

The build plugin that trims the tables to the glyphs an app uses is in
[icons](https://github.com/orochi235/weasel/blob/main/docs/icons.md). Each component has its own entry, `@weasel-js/ui/components/<Name>`,
so a bundle holds only the ones it imports; the main entry re-exports them all.

A `Slider` or `BandEditor` that maps values onto its track non-linearly takes a
scale from `@weasel-js/plot/scales`: `<Slider scale={logScale} … />`. `Plot2D`'s
generated ticks and the `Timeline` ruler's come from the same scales, and a
custom `TickSettings.format` receives their `TickFormatCtx`.

## License

MIT
