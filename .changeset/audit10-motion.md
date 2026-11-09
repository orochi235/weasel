---
'@weasel-js/animator': patch
'@weasel-js/audio': patch
'@weasel-js/headless': patch
---

Fixes to slews, color cycles, bus gains and the node raster host found by an audit of the motion and media packages.

- `slewToward` and `createSlew` stay finite over a step of zero time. A direction with no rate jumps to the target whatever the step, and a limited one holds over a zero, negative or NaN step. Before, an unlimited direction over `dt` 0 answered NaN, and a slew kept that NaN from then on.
- `cycleVertexColors` throws a `RangeError` for a `msPerCycle` that is not positive, before it installs anything. Before, 0 or NaN painted NaN colors, and a negative time turned the colors backward, which `direction: -1` does.
- A bus's `setGain` throws a `RangeError` for a value or ramp that is not finite, and keeps the gain it had. Before, it kept a NaN gain, and every later mute or solo on any bus rewrote it and threw from a real `AudioParam`.
- A voice's `setGain` refuses the same, by the same check, and keeps the level it had. Before, a NaN gain made every later `setPosition` on the voice throw.
- A node raster host's `render` returns pixels whose `data.buffer` holds only them. Before, a small image was a view into Node's shared `Buffer` pool.
- A node raster host disposed while its page is still opening rejects the render in flight as on a disposed host, rather than with the closed page's error.
