---
"@weasel-js/geom": patch
"@weasel-js/kernel3d": patch
---

Give `Vec3` named fields, so both dimensions say `p.x`.

`@weasel-js/geom`'s 2D tier has no point struct on purpose — it passes loose
components so the f32-relative epsilon policy has nothing between it and the
numbers — and `core` wraps those in `Vec2` at the API tier, where a call site
reads better with names. `geom/3d` had to pack, since loose scalars stop
working at four and sixteen components, but it packed into a tuple, and
`@weasel-js/kernel3d` then re-exported that kernel type at its own public
surface: `Pose3.position` and `Camera3d.target` were both `Vec3`.

So at the position a consumer actually handles, 2D said `pose.x` and 3D said
`pose3.position[0]`. Packing was forced; the tuple was not.

`Vec3` is now `{ readonly x, readonly y, readonly z }`. The fields are readonly
because the tuple's immutability was load-bearing: a pose in a history snapshot
must not be writable through the value handed to a renderer. `Quat` stays a
tuple — it is not a point, and `[x, y, z, w]` is the layout three.js and
glMatrix both use.

Breaking for anyone indexing a `Vec3`, which is why it is worth doing while the
type is a week old.
