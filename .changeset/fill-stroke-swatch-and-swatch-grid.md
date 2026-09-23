---
'@weasel-js/ui': patch
---

Two paint controls for drawing apps. `FillStrokeSwatch` shows the active fill and stroke as the overlapping pair: fill a solid square behind, stroke a frame in front that the fill shows through. Each chip is a native color picker that reports `onInput` while it is open and `onChange` once when it closes, and the chip that has focus is the one the None button acts on. Given the matching callbacks it also adds shift-click-for-none, a None button, Swap and Default. `SwatchGrid` is a palette that applies a color on click, or sends it to an alternate target on shift-click, right-click or Shift+Enter. It takes one tab stop, and the arrow keys move by one swatch across or by a row up and down. Both draw a translucent color over the `--wzl-checker-*` checker and mark "no paint" with the danger diagonal. Neither holds any paint state. The app routes each pick to its own state, and to the selection through `useOngoingAction`.
