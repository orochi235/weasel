---
'@weasel-js/prefs': patch
'@weasel-js/routing': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group or a section can name a glyph: `icon?: IconRef`, as a pref leaf's `icon` already does. A bar with `lead: 'icon'` (new beside `'label'`) starts its line with that glyph, in `Bar`, `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`. The button a bar opens a `menu`, `page`, `tab` or `panel` group from draws the glyph before its name, and so does that group's submenu row in a menu built by `resolveSchemaMenu`. `BarMenu` takes an `icon` as `BarPopover` does, and `BarLayout` and `Bar` take an `icon` prop. The schema editor offers `icon` for those groups and `icon` as a lead.
