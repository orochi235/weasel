# @weasel-js/clock

A clock for a run of time: a position (`elapsed`) moved by a signed `rate`,
across one pass or many, with ramps, seeking and an optional mix that follows it.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/clock).

```sh
npm install @weasel-js/clock
```

`createClock` and `createClockRegistry` are the root entry and need no React or
DOM. `useClockLoop`, the one frame loop that syncs a registry's clocks, is in
`@weasel-js/clock/react`.
