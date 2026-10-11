---
'@weasel-js/core': patch
---

Animations can move a target, and several on one target add. This is new API; nothing existing changes.

`createTarget({ get, set, axes?, show? })` wraps one value: `get` and `set` read and write what is committed, the value that shows when nothing is animating. `tween`, `spring`, `physics`, and `decay` take `target` in place of `onTick`. An animation on a target commits its destination as it starts and contributes only what it has left to travel, so a second one started mid-flight bends the motion toward its own destination and neither cancels the other. `target.read()` is the value to show, and `show` is handed it once a frame while the target moves.

- `from` defaults to the committed value, so the value on screen does not move as an animation starts.
- Canceling commits where the animation was. A coast (`decay`, or `physics` with `to: null`) commits where it stops.
- Under one `cancelKey` the new animation still interrupts the old. A spring interrupting an animation on the same target starts at that one's velocity unless given its own.
- `axes.angles` names axes that are angles in radians; an animation takes the short way round on them.
- A target is moved by one animator at a time; a second throws.
