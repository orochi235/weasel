# @weasel-js/scales

Scales map values onto a range and back: `linearScale`, `logScale`, `powScale`, `warpScale`, `timeScale`,
`bandScale`, `ordinalScale` and `polarScale`. Each continuous scale also picks the ticks an axis marks, and
`formatTick` writes them. No React, no DOM and no scene, so a slider that places values along its track, a
chart, or a server laying out an axis takes them alike.

```ts
import { linearScale } from '@weasel-js/scales';

const x = linearScale({ domain: [0, 100], range: [0, 400] });
x.map(25); // 100
```
