---
'@weasel-js/labkit': patch
---

`<Lab>` sizes itself correctly on a page that has not been reset for it

`.lk-lab` is `height: 100%`, which resolves against its containing block, so
the component only filled the window when the host had already given every
ancestor a height and zeroed the body margin. Every example in this repo
hand-writes `html, body, #root { margin: 0; height: 100% }` to make that true,
and a consumer who supplies the height but not the margin reset got a page
taller than the viewport — one wheel notch of scroll, which reads as a stuck
canvas rather than as overflow. Supplying neither collapsed the lab to zero
height and rendered a blank page.

`styles.css` now carries the reset the component's own sizing assumes, scoped
with `:has` so a page that mounts no lab is untouched. It reaches the lab's
own parent and stops there, so a lab embedded in a sized box still fills that
box and cannot resize its host's layout.
