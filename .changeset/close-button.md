---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

New `CloseButton`: the kit's `close` glyph at 16px in a square `--wzl-icon-button-size` target, named by a required `ariaLabel`, with an optional `tooltip`. `SidebarPanel`'s hide button, `Dialog`, `Callout` and `Toast`'s close buttons, the remove buttons in `ListEditor` and `LayerList`, and labkit's mark list now all draw it. Most of them drew a text `×`, whose ink was about 5px across, so the enlarged close glyph never reached them. Accessible names and behavior are unchanged. labkit's `weasel-ui` passthrough re-exports it.
