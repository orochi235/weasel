# @weasel-js/d3

d3 bridge for weasel: data-join + transition chain over useScene and useAnimator. d3-force already integrates via useSimulation in the main kit.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/d3
```

## Usage

`d3Bind` binds an array to a scene's leaves by key. `join()` takes no
arguments: entering, updating and exiting are a diff it works out by key,
and `.exit(fn)` hands you the exit set when you want to handle it yourself.

```ts
import { d3Bind } from '@weasel-js/d3';

const binding = d3Bind(scene, points, { key: (d) => d.id, animator })
  .pose((d) => ({ x: d.x, y: d.y, width: 8, height: 8 }))
  .data((d) => ({ label: d.name }))
  .join();

binding.transition()
  .duration(400)
  .delay((_d, i) => i * 20)
  .pose((d) => ({ x: d.x * 2, y: d.y, width: 8, height: 8 }))
  .transition()          // starts on each item once the one before finishes it
  .remove()              // deletes each node when its transition ends
  .end();                // a promise for the whole chain
```

`.transition()` needs the `animator` option. Force layouts come from
`useSimulation` in `@weasel-js/core` rather than this package. The site's
`ForceGraphDemo` and `D3SortableDemo` show both.

## License

MIT
