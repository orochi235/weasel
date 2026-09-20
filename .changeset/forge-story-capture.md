---
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Mark up a forge story and export the picture with the marks on it. A story instrument now declares an annotation target for the story itself: the frame serializes its own subtree into an SVG `<foreignObject>` and sends it back over the frame's message channel as the target's `base()`, and the target's content box is the size the frame already measures.

labkit's annotation rail gains an `Interact` tool, which is what a lab with an annotating instrument now starts in. The overlay's input box passes pointer events through while the rail holds a tool that makes no marks, so an instrument under it — a forge story, say — stays clickable. Before this, the rail's default `Select` sat over every picture and took every click.

New in `@weasel-js/forge/shell`: `TrialFrame.capture`, `TrialFrame.size` and `TrialFrames.hostRef`. `TrialFrames.connect` takes `capture` alongside `send` and `audit`.
