# @weasel-js/geom

Pure 2D geometry kernel for @weasel-js/core: affine, box, curve, polyline, the
`Path` command stream and the math over it (builders, SVG `d` parsing, bounds,
transforms, hit-testing, sampling, curve fitting), and easing curves.
Dependency-free core. Subpaths:

- `./curves` — alternate curve representations (cubic and quadratic Bezier, NURBS, Spiro)
- `./tessellate` — fill tessellation, polylines and trimming; needs the optional peer `earcut`
- `./booleans` — polygon booleans and path splitting; needs the optional peer `polygon-clipping`
- `./3d` — vectors, quaternions, 4x4 matrices and ray intersection
- `./nd` — the port-curve rule (`portControls`, `portCurvePoints`, `PORT_REACH`) over plain number arrays, for any dimension

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/geom
```

## Usage

```ts
import { /* … */ } from '@weasel-js/geom';
import { /* … */ } from '@weasel-js/geom/booleans';
import { /* … */ } from '@weasel-js/geom/curves';
import { /* … */ } from '@weasel-js/geom/tessellate';
```

## License

MIT
