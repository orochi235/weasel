# weasel-js

An alias for **[`@weasel-js/core`](https://www.npmjs.com/package/@weasel-js/core)** —
the batteries-included entry point of weasel, a domain-agnostic 2D scene-graph
canvas kit for React.

This package exists only so `npm install weasel-js` works. It re-exports
`@weasel-js/core` in full, including every subpath. The two are interchangeable
and released in lockstep at the same version.

**Prefer `@weasel-js/core` directly** if you're already installing other
`@weasel-js/*` packages — mixing the two names in one project works (npm
dedupes them), but there's no reason to.

## Install

```sh
npm install weasel-js
```

## Usage

```ts
import { SceneCanvas, useScene } from 'weasel-js';
import { registerFont } from 'weasel-js/renderer';
```

Narrower pieces ship separately and can be used without the React canvas:
[`@weasel-js/geom`](https://www.npmjs.com/package/@weasel-js/geom) (dependency-free
geometry kernel) and
[`@weasel-js/history`](https://www.npmjs.com/package/@weasel-js/history)
(headless undo engine).

See the [API reference](https://orochi235.github.io/weasel/api/).

## License

MIT
