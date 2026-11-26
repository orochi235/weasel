# @weasel-js/lottie

Writes a `@weasel-js/animator` clip, with the `@weasel-js/svg` nodes it moves, as a
[Lottie](https://lottiefiles.github.io/lottie-docs/) animation: the JSON a Lottie player such as
lottie-web plays.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic
scene-graph engine for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/lottie).

```sh
npm install @weasel-js/lottie
```

## Writing a clip

```ts
import { parseSvg } from '@weasel-js/svg';
import { writeLottie } from '@weasel-js/lottie';

const nodes = parseSvg('<svg><path id="line" d="M0 0 L100 0" stroke="#000"/></svg>');
const json = writeLottie(nodes, {
  version: 1,
  loop: true,
  tracks: [{ kind: 'sampled', target: 'line.trim.end', keys: [{ t: 0, value: 0 }, { t: 800, value: 1 }] }],
}, { fps: 60, onWarn: console.warn });
```

Tracks are named `<id>.<property>`, as the SVG writers in `@weasel-js/svg/animate` name them.

| Track | Lottie |
|---|---|
| `<id>.opacity` | the layer's opacity, in percent |
| `<id>.trim.start`, `<id>.trim.end` | a trim of the stroke, fractions of the path's length written in percent, its subpaths laid end to end and trimmed as one; an edge with no track rests at the stroke's own trim |

Each drawn path is one shape layer holding its subpaths, its solid stroke and its solid fill; the
last path drawn is the first layer, since Lottie draws its first layer on top. Group transforms and
rotations are baked into the geometry, a stroke's width scaled with them, and the canvas is the
drawing's bounds unless `viewBox` gives another. Keys become frames
at `t / 1000 * fps`. A bezier easing becomes the keyframe's tangents, a single end step a hold,
and any other easing the keyframes that trace it.

Lottie has no field for how often an animation plays, and players loop, so a clip that does not loop
warns. So does anything else the animation cannot carry: a gradient, a dash, a marker, a text node,
a group's opacity over overlapping paths, a transform that scales a stroke unevenly, a track on
another property or on an id no path has. Each warning is said once, through `onWarn`.

`lottieShapesOf(path)` gives a path's subpaths as Lottie beziers on their own.
