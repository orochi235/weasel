---
'@weasel-js/core': patch
---

`createParallaxLayer` takes an optional `getOuterView`, so a plane can derive
from a ref-driven camera. It previously derived only from the canvas's `view`
prop; a consumer keeping a 60 Hz camera out of React state pins that prop to
identity and got identity back for every `pan` value — a backdrop that silently
never moved.

`useHandTool` no longer builds a velocity tracker and a decay loop it never
uses. `inertia` and `axis` were already inert; they are now documented as such
until the `viewport.dragPan` action implements them.
