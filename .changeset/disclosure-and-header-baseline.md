---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Add `<Disclosure>`, and sit the lab header's controls on the title's baseline.

**`Disclosure`** is the twisty on a collapsible section: a triangle that turns
as it opens. It holds no state and renders no children — the consumer owns both,
and `aria-expanded` ties the control to them. `DisclosureRow` puts one beside a
row of content.

It settles three things every hand-rolled twisty gets wrong. The mark is drawn
rather than typed, because `--wzl-font-ui` carries no ▸/▾ and a text glyph falls
back to whatever the system offers at whatever size that font renders it —
around 6px against 13px body text. The hit target is at least 20px and grows
with the mark, rather than being the mark's size. And it sits outside the row's
label rather than inside it, so clicking to expand does not actuate the label's
own control.

Like `DragHandleGlyph`, it stays out of the icon register: that register is
outline strokes at a fixed weight, and `icons/base.mjs` rejects a solid triangle
in it by name.

**The lab header** aligned its controls to the center of the row, so every
control label sat off the title's baseline — 5px, for the `Add trial` button.
The header and its actions row now align on the baseline. The button needed one
more thing: a flex container reports its *first* item's baseline, and the
leading `<svg>` icon has none, so the button handed the header a baseline
synthesized from the icon's bottom edge. It aligns on the baseline internally
now, with the icon keeping its own centering through `align-self`.
