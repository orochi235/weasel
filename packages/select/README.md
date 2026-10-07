# @weasel-js/select

Selection as a value: which ids a press selects, under toggle, range and anchor rules a surface
configures. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/select
```

## Usage

```ts
import { intentOf, select } from '@weasel-js/select';

// A list's convention: Cmd/Ctrl toggles a row, shift ranges from the anchor.
const policy = { mode: 'multi', toggle: ['meta', 'ctrl'], range: 'shift' } as const;

let state = { ids: ['b'], anchor: 'b' };
state = select(state, 'd', intentOf({ shift: true, meta: false, ctrl: false }, policy), {
  order: ['a', 'b', 'c', 'd'],          // what a range walks
  eligible: (id) => id !== 'c',         // locked rows never join a multi-selection
});
// → { ids: ['b', 'd'], anchor: 'b' }
```

| intent | ids | anchor |
|---|---|---|
| `replace` | `[id]` | `id` |
| `toggle` | eligible ids, with `id` added or removed; `[id]` if `id` is ineligible | `id` |
| `range` | eligible ids from anchor to `id` in `order`; unchanged if none is eligible; `[id]` if there is no anchor or either end is outside `order` | unchanged |

`createSelectionStore` keeps ids outside a component, behind the `SelectionStore` contract that
`@weasel-js/core`'s `Scene` also satisfies.

## License

MIT
