---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`Dialog`, `Toast`, `Tooltip`, `Callout`, the menu and picker popovers, and labkit's drag ghost cast their shadow in `--wzl-shadow`, where each held its own black at 0.18 to 0.45. Visible: in dark mode those shadows are now the token's 0.6, and in light mode its 0.18. No person has looked at the result.

Adds a token: `--wzl-scrim`, what a modal dims the page behind it with. It is black at 40%, the literal `Dialog` held, so a dialog's backdrop is unchanged.
