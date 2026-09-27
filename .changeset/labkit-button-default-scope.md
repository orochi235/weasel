---
"@weasel-js/labkit": patch
"@weasel-js/ui": patch
---

labkit's default look for a bare `<button>` now reaches only a button with no class or a labkit (`lk-`) class. It used to reach every weasel-ui button inside a lab too, filling in whatever the component left unset: ToolButton, Disclosure's twisty, SidebarPanel's hide button, Timeline's transport buttons, BandEditor's bands and others were forced to the control height (a tall one clipped its own icon), picked up a backdrop blur, and turned accent on hover. Inside a lab those components now look as they do anywhere else.

A consumer's own classed `<button>` inside a lab no longer gets the default either. Leave it unclassed to keep the default, or style it through its class. The rules several ui components carried to undo the default are gone.
