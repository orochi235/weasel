# @weasel-js/ui-logic

Headless components: what a DOM component and a canvas-drawn widget share past their drawing. Today that is
the measure/draw contract a button and a row list implement on both targets, and keyboard focus as one
contract. No React, no DOM. What a key or a pointer does to a control is `@weasel-js/ui-input`.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/ui-logic).

## Install

```sh
npm install @weasel-js/ui-logic
```

## Focus

`FocusScope<T>` is keyboard focus over a set of targets, whatever draws them: which one is
focused, whether its ring shows, `focus`, `moveFocus` through a `tabOrder`, and
`subscribeFocus`. A `@weasel-js/hud` HUD is one over its widgets, and `@weasel-js/ui`'s
`domFocusScope(root)` is one over the elements under `root`, so code that moves focus is
written once for both. `tabSort` and `tabStep`, the order and the step both use, are `@weasel-js/ui-input`'s.

## Measure and draw

`HeadlessComponent<S, L, T, O>` is the contract a control implements on every target: `measure(state,
constraints, env)` gives its box (width, height, first baseline) and where its parts sit, and `draw(state,
target)` renders it in the target's own output. `measure` is shared: it reads only the state and a
`MeasureEnv`, the target's tokens and text metrics, so a DOM component and a canvas widget in one theme
measure alike. `draw` is per target and does not take the measured box: a target that positions by
coordinates measures with `exactly(w, h)` itself, and the DOM lays out by CSS from the same tokens.

`measureButton` and `measureRowList` are the two so far, with `buttonParts` and `listMode` saying which
parts and roles a state shows. `@weasel-js/ui`'s
`domButton` and `domItemList` and `@weasel-js/hud`'s `hudButton` and `hudList` implement them.

## License

MIT
