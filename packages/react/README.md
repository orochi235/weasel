# @weasel-js/react

Generic React hooks the weasel packages share: `useLatest`, a ref holding the
value of the last committed render, and `useStableByContent`, which keeps one
identity for a value rebuilt equal every render. No weasel domain in it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/react
```

## Usage

```ts
import { useLatest } from '@weasel-js/react';
```

## License

MIT
