---
'@weasel-js/ui': patch
---

Fixes: a removable `pill` or `plain` `Badge` padded through `style` kept the click target of its unpadded size. The label reaches into the badge's padding by the `--badge-pad-*` properties, which only the `padding` prop set. `padding`, `paddingTop`, `paddingRight`, `paddingBottom`, `paddingLeft`, `paddingBlock`, and a one-value `paddingInline` in `style` are now set as those properties too, and win over the `padding` prop. The badge's own padding is what it was. A two-value `paddingInline` still pads the root only.
