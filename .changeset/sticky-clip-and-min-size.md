---
'@weasel-js/core': patch
'@weasel-js/text-dom': patch
'@weasel-js/svg': patch
---

A text node can cut its text at its box: `data.overflow: 'clip'` draws the glyphs in a group clipped to the pose box, picks only the lines inside it, cuts the editing overlay to the same box (`TextEditScreenPose.clip`, read through `useSceneTextEdit`'s new `getOverflow`), and exports as an SVG group clipped to the box. Properties offers it as a Clip switch. A node can also carry a minimum size, `data.minSize` (`MinSize`, `minSizeOf`): a resize stops at it whatever the resize policy's constraints, a multi-selection stops where its first member reaches its own, and a scale replayed through transform-again holds to it. An insert or place binding's `minSize` param grows a smaller drag or click to it and is kept on the node. Sticky notes now clip their text and keep a 48 × 48 minimum, both set through `toolOptions.sticky` (`overflow`, `minSize`). An SVG import reads a clipped note back as a clipped group around its text, not as a text node that clips.
