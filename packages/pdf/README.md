# @weasel-js/pdf

PDF documents from weasel draw commands: vector paths, shadings, images, and
embedded fonts with selectable text. No scene graph, no React.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/pdf).

## Install

```sh
npm install @weasel-js/pdf
```

## Usage

```ts
import { writePdf } from '@weasel-js/pdf';

const { bytes, skipped } = await writePdf(
  [{ width: 612, height: 792, commands }],
  { fonts, title: 'Chart' },
);
```

Page units are points, with the origin at the top left and y growing downward.
`skipped` lists what could not be written as vectors.
