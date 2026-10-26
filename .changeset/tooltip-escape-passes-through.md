---
'@weasel-js/ui': patch
---

An open tooltip no longer swallows an Escape pressed somewhere else. React Aria takes the first Escape while a tooltip is open, wherever focus is, so with a tooltip showing over a hovered toolbar button, Escape in a text editor or on the canvas only closed the tooltip. Now an Escape pressed away from the tooltip's trigger closes the tooltip and also reaches where it was pressed; one pressed on the trigger still only closes the tooltip.
