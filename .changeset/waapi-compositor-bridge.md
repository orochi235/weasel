---
"@weasel-js/animator": patch
---

Hand animator runs on DOM elements to the browser's compositor. `createElementTarget({ element, style, value })` makes a target shown as an element's inline style; a `tween`, `spring`, `decay`, or `physics` that runs alone on one, has no `onTick`, and whose style is only `transform`, `translate`, `rotate`, `scale`, and `opacity` is sampled into keyframes and handed to `Element.animate`, so it costs the main thread nothing per frame. The animator's clock stays in charge: pause, resume, time scale, reversal, an outside clock's seeks, and time spent hidden all re-place the browser animation, and a cancel commits where it stands. Another animation or hold on the target takes the run back to the main thread, where the two add. A new `compositor: 'auto' | 'off' | 'require'` option on every target animation chooses, and `animator.live()` marks handed-off rows `compositor: true`. Additive: nothing changes for existing targets.
