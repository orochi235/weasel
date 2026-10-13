# @weasel-js/registry

Keyed registries with a uniform reflection surface: enumerate the entries, see which ones displaced others, release any one of them, and subscribe to changes. Also the small shared pieces registries are built from: an emitter, a plain-object test, and the MIXED sentinel. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/registry
```

## Usage

```ts
import { createReflectable } from '@weasel-js/registry';

const cursors = createReflectable<string>();
cursors.push('pen', 'crosshair', { source: 'kit' });
cursors.push('pen', 'cell', { source: 'plugin' });

const [pen] = cursors.reflection.entries();
pen.value; // 'cell'
pen.shadowed; // [{ value: 'crosshair', source: 'kit' }]

cursors.release('pen', pen.live);
cursors.get('pen'); // 'crosshair'
```

## Exports

- `createReflectable<V, K>()` — a keyed store a registry embeds. It returns a
  `Reflectable`: the write side (`push`, `set`, `release`, `delete`, `clear`,
  `bump`) plus `reflection`, the read-only `Reflection` (`get`, `has`,
  `entries`, `subscribe`, `getVersion`) a registry hands out. `subscribe`,
  `getVersion`, and `entries` are shaped for `useSyncExternalStore`.
- `ReflectedEntry` — one key as `entries()` reports it: `key`, `value`,
  `source`, `live` (the registrant holding the key), and `shadowed` (the
  registrants it displaced, oldest first).
- `Registrant` — one `{ value, source }` claim on a key. Each is a frozen
  object that keeps its identity, which is what `release(key, registrant)`
  takes.
- `RegisterOptions` — the `{ source }` that `push` and `set` accept.
- `createEmitter()` and `Emitter` — a listener set with `subscribe`, `emit`,
  and `size`. A listener that throws is reported to `console.error` and does
  not stop the rest.
- `isPlainObject(value)` and `isPlainPrototype(proto)` — plain-object tests
  that hold for objects from another realm.
- `MIXED` and `Mixed` — the sentinel for a value aggregated across sources
  that disagree.

## License

MIT
