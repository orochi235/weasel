---
"@weasel-js/ui": patch
---

Fix interaction bugs across ui's inputs, menus, lists and panels:

- An action's settings popover stays shut when the action is disabled and enabled again, instead of reopening by itself.
- An action's settings form gets the values its `read` returns, `Infinity` and `undefined` included, instead of a JSON round trip of them.
- A `Dialog` in a contained portal honors `shouldCloseOnInteractOutside`.
- A command palette row runs on a primary press only, not a right or middle click.
- `ComboBox` reports no option `onCommit` when a blur or Enter only restores a controlled selection's text.
- A slider region drag moves as far as its room allows, not only by its own width.
- A track press with `move-nearest` moves the thumb nearest on screen, not nearest in value, under a log or even-spaced scale.
- `DetentSlider` offers a detent again after the consumer declines it.
- A `CurveEditor` anchor hidden by `hideNonInteractive` no longer takes presses meant for the curve.
- A property slider's readout writes nothing when focused and left as it showed, and a slider with no value stays reachable by keyboard.
- A selection panel draft that never committed no longer undoes a later change to the node.
- `useHeldKeys` lets go of held keys when focus leaves an element target.
- The selection panel names the paint nodes inherit from containers whose paints are equal but separate objects.
- `TokenField` swallows a comma typed into an empty field rather than adding a `,` token.
- `ItemList`'s `overlay` no longer counts as a row in a reorder drag.
- `useSceneLayerList` places a top-level drop correctly past annotation rows and annotation nodes.
- `Timeline` keeps focus on the selected key after Delete removes the focused one.
- `LayerList` range selection includes cards between the two ends.
- A `Toolbar` turned from roving to not roving gives every button its tab order back.
- A `MenuBar` menu that closes because its title turned disabled hands focus back instead of dropping it to the page.
