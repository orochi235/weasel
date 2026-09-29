---
'@weasel-js/labkit': patch
---

Values labkit reads outside render — in event handlers, frame loops, the surface's clears and painters, and an annotation store's `targets` and `config` — now come only from renders that committed. A render React started and then threw away (a transition that suspended, or one interrupted by a more urgent update) used to leave its props behind for the next event to read. For example, a camera could report and set the abandoned render's view, a loupe could aim or sample while it was turned off, and an annotation pane could open the WebGL context of a buffer it never committed to. Chrome that reads a trial's annotation store while it renders now renders again once a change to the trial's state, view or config has committed.
