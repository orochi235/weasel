---
'@weasel-js/ui': patch
---

Add `EffectList`: an ordered list of effects or operations that run top to bottom, each drawn as a card in its kind's color. A card is dragged by its number, or moved with Alt+Up and Alt+Down from anywhere in it, and a press on the number that does not drag opens or closes it. Each card switches on and off, is renamed in place, and can be duplicated and removed, and only the open card shows the body `renderBody` draws. A kind's `color` is a tint index or a color source, like any other color a kit component takes.
