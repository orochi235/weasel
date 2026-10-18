---
'@weasel-js/svg': patch
---

`serializeSvg` takes `textLayout`, a function returning the lines a text node lays out into — core's `layoutTextPose`. With it, each laid-out line is written as a `<tspan x y>` at the layout's own position, sitting on its baseline, so another reader draws wrapped text wrapped; each word of a line the layout justified gets its own `x`; and a line holding a larger run is pitched where the renderer puts it rather than at the node's font size times its line height. `parseSvg` reads such a `<text>` back as the same paragraphs, with its wrap, justification, and line height. `svgNeeds` and `warmSvg` take the same option and then list and load every face the text is set in. Without the option the output is unchanged.
