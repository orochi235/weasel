---
'@weasel-js/diagram': patch
---

EffectChart fixes and additions:

- `rack` widens a stage on its line so the side ports along its top or bottom sit at least `SIDE_PORT_GAP` (24) apart, however many there are.
- Branch symbols take `{ controlSide, style, tints }`. `rack` passes `controlSide: 'bottom'` with `side: 'below'`, so a control wire comes straight up from the stage driving it; a diamond's second exit moves to its top vertex when control inputs hold the bottom. A symbol's lines, dots and ticks take the `text` color of `style` (default `stageStyle(stage)`), so a bypassed decision draws dim and a look can restyle it; a bar's bands take `tints`.
- `EffectLook`'s options parameter defaults to `never` rather than `unknown`, so `[nodeGraph, rack]` is an `EffectLook[]` without a cast. Breaking for code that called a plain `EffectLook` with options: give it the options type, `EffectLook<MyOptions>`.
- `EffectChart` takes `minScale`, default `EFFECT_MIN_SCALE` (0.5), so a large chart opens readable at its start instead of fitted whole and tiny.
- Under a run, a `switch` symbol is thrown to the output the decision took, and `EffectChart` fades the port dots of stages the run never reached.
- `edgeIdOf` escapes `.`, `>`, `:`, `/` and `\` in an edge's ends, ports and label with a backslash, so two different edges never share an id. Breaking for code that built an edge id by hand for ids, ports or labels holding those characters; use `edgeIdOf`.
