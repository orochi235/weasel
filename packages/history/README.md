# @weasel-js/history

Undo/redo history with scoped sub-history (Journal) primitive. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/history).

## Install

```sh
npm install @weasel-js/history
```

## Usage

A history applies ops and records them; an op knows how to apply itself and how to invert. `swapOp` is
the op for an edit that replaces one whole value with another:

```ts
import { createHistory, swapOp } from '@weasel-js/history';

let title = 'Untitled';
const history = createHistory(null);
const rename = (next: string) =>
  history.apply(swapOp({ name: 'rename', label: 'Rename', before: title, after: next, emit: (v) => { title = v; } }));

rename('Draft');
history.undo(); // title is 'Untitled'
history.redo(); // title is 'Draft'

// A journal keeps its own undo steps, then lands in the history as one entry.
const journal = history.beginJournal({ label: 'Retitle' });
journal.applyBatch([swapOp({ name: 'rename', label: 'Rename', before: title, after: 'Final', emit: (v) => { title = v; } })], 'Rename');
journal.commit('Retitle');
```

The argument to `createHistory` is the adapter every op's `apply` is handed; `swapOp` needs none. A
weasel scene keeps one of these for you (`scene.undo()`, `scene.history`).

## License

MIT
