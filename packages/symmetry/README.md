# @weasel-js/symmetry

Live symmetry groups. A symmetry group is a container whose mirrored, rotated
and repeated copies are drawn from its real children rather than stored, so
editing a child reaches every copy, and a click on a copy selects the child it
copies.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/symmetry).

```sh
npm install @weasel-js/symmetry
```

## Kinds

Each kind is a list of transforms about the group's center, the original not
among them. `angle` is in radians from +x toward +y, which is clockwise on
screen. `VERTICAL_AXIS` mirrors left and right, and `HORIZONTAL_AXIS` mirrors
top and bottom.

| Kind | Copies | Fields read |
| --- | --- | --- |
| `mirror` | one reflection across the line at `angle` | `angle` |
| `both` | reflections across `angle` and the line square to it, and the half turn | `angle` |
| `point` | the half turn | — |
| `radial` | `count - 1` turns, evenly spaced | `count` |
| `kaleidoscope` | the radial turns, and a mirror through each wedge | `count`, `angle` |
| `repeat` | `count - 1` steps of `spacing` along `angle`, every other one mirrored under `glide` | `count`, `spacing`, `angle`, `glide` |

`SYMMETRY_KINDS` holds them as a table, and a new kind is a row in it.

## Use

```tsx
const scene = createScene({ systemLayers: [{ id: 'main' }], registry: symmetryRegistry });
const symmetry = createSymmetry(scene);
symmetry.create({ center: { x: 300, y: 200 }, symmetry: { kind: 'kaleidoscope', count: 6 } });

<SceneCanvas scene={scene} ambient={[symmetry.contribution]} />
```

`symmetry.contribution` does three things on the canvas:

- It draws the active group's guide: the mirror lines, and the handles that
  move the center, turn the axis, and stretch a repeat. Shift holds the angle
  to 15° steps.
- It answers core's `insertInto` dep, so every tool draws into the active
  group.
- It answers core's `pathSymmetry` dep. When a path's anchors are dragged or
  nudged, if the path is its own image under some of its group's transforms,
  every image of what moves follows, and an anchor on an axis stays on it.

`symmetry.update(id, { spec, center })` changes a group as one undo step.
`symmetry.bake(id)` replaces it with a plain group holding real copies of its
leaves, each one's pose turned or mirrored the way the live copy drew it.

Without `symmetryRegistry` a group still draws, but `scene.toJSON()` refuses
it. Exported to SVG, each copy is written as a transformed group.

Under the hood the group is a core container with `copiesFromPose`, which any
container can carry.
