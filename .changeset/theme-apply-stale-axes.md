---
"@weasel-js/theme": patch
---

`applyTheme` on an element that held a theme with other axes takes off the `data-wzl-<axis>` attributes the new theme does not have. They used to stay, so where the old theme shared the new one's name, its rule, held for another element, still matched this one and could win the cascade.
