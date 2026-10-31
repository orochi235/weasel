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

```ts
import { /* … */ } from '@weasel-js/ui';
import '@weasel-js/ui/style.css';
```

The stylesheet is required — component styles ship as one bundled file.

A `Slider` or `BandEditor` that maps values onto its track non-linearly takes a
scale from `@weasel-js/plot/scales`: `<Slider scale={logScale} … />`. `Plot2D`'s
generated ticks and the `Timeline` ruler's come from the same scales, and a
custom `TickSettings.format` receives their `TickFormatCtx`.

## License

MIT
