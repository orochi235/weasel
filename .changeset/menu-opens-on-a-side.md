---
"@weasel-js/menu": patch
"@weasel-js/routing": patch
"@weasel-js/ui": patch
---

A menu hung from a button opens on a side of it, not only below or above. `placeMenuUnder`'s last argument is now a `MenuSide` (`'top' | 'bottom' | 'left' | 'right'`, default `'bottom'`) where it was the boolean `above`; beside the button the menu is top-aligned and flips to the other side when it does not fit. `MenuOpenRequest` and `OpenMenu` carry `side` in place of `above`. This is a breaking change for anyone passing `above`: pass `side: 'top'` instead. A curved `Bar`'s menus now open on the side their item faces, where `'left'` and `'right'` used to open below.
