# @weasel-js/text-dom

In-place text editing over a canvas: a `contenteditable` overlay that reads and
writes styled runs.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

```sh
npm install @weasel-js/text-dom
```

`useTextEdit` mounts an editable element over a box on screen, set in the same
face, size, and alignment the canvas draws the text in, and hands back the
edited text as `StyledRun`s from `@weasel-js/text` when the edit commits. It
takes a screen pose and a `TextStyle`; it does not know about a scene graph or
a renderer. `useSceneTextEdit` in `@weasel-js/core` is this hook wired to a
scene node.

While an edit is open the hook reports the selection's shared style
(`MIXED` where the selected runs disagree) and applies a style or a flag such
as bold to the selected range.

`runsToDom` and `domToRuns` are the conversion between runs and the overlay's
DOM, and `charOffsetToDomPosition` / `domPositionToCharOffset` map a character
offset in the text to a DOM position and back.
