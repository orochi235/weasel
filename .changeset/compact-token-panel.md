---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

`TokenPanel` has one compact layout: a token to a line, names on a rail, values at the small text size. The `density` prop is gone (this breaks any caller passing it). `namePrefix` leaves a shared prefix such as `--wzl-` off every name, with the full name kept in the tooltip. Rows that share a group show the group's name once down the rail. Empty values read `unset`, and a reset is an icon in its own column. Scale steps span the panel's width, with their labels lined up over the digits.

The small `ToggleBar`, `ButtonBar` and `OptionsBar` take their height from their font size, so descenders no longer clip. In light mode, the secondary `Button` drops its dark text shadow and the primary one lightens it.

New icons: `drop`, `type`, `typeface` and `more`.

labkit: a `SidebarSection` can carry `actions`, drawn in its title bar (docked or torn out) and hidden while it is folded. Section title bars stay pinned while their bodies scroll, and expose their height as `--lk-section-bar-h`. An `Instrument` can supply `renderTitle` to draw its trial's title as more than text.

forge: the CSS Vars header has a bar of section icons that jumps to a section and highlights the one in view. Each folder in a trial's breadcrumb links to that folder in the story tree, opening the Tree or Gallery view if the current view doesn't have it. A global can name the `icon` on its popover button; Font now uses `typeface`. Package badges in the story tree now sit centered on their checkboxes.
