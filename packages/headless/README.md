# @weasel-js/headless

Component behavior with no substrate: what a DOM component and a canvas-drawn widget both run,
each drawing it its own way. Today that is a list's roving highlight and typeahead. No React, no
DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/headless).

## Install

```sh
npm install @weasel-js/headless
```

## Usage

```ts
import { EMPTY_TYPEAHEAD, rovingKey, typeaheadStep } from '@weasel-js/headless';

type Row = { name: string; heading?: boolean };
const shape = { canStop: (r: Row) => !r.heading, label: (r: Row) => r.name };

let at: number | null = null;
let typed = EMPTY_TYPEAHEAD;

function onKey(rows: readonly Row[], key: string): void {
  const r = rovingKey(rows, at, key, shape);      // arrows, Home, End
  if (r.handled) { at = r.at; return; }
  if (key.length === 1) {
    const t = typeaheadStep(rows, at, typed, key, Date.now(), shape);
    typed = t.buffer;
    if (t.hit !== null) at = t.hit;
  }
}
```

A list's shape says which items the highlight can land on (`canStop`), which arrows move it
(`orientation`, vertical by default) and whether it wraps at the ends (`wrap`, on by default).
`@weasel-js/menu` runs every menu level on these.

## License

MIT
