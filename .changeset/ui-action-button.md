---
'@weasel-js/ui': major
'@weasel-js/labkit': patch
---

One `ActionButton` replaces `ToolButton`, `Bar.Button` (`BarButton`), and `BarActionButton`, and draws in the form of where it sits.

In a `Bar` it is a cell: its icon alone, with its label and shortcut in its tooltip, or its words where it has no icon or is `labeled`. In a bar's overflow menu it is a row of icon, label, and shortcut; in a form's row or a popover's, icon and label across the row; and in a `ToolGroup` (so in a `ToolRail` or `ToolPalette`) a palette's tool, its label and shortcut under its icon. `form` names one outright. `label` is its name, `children` replace its words on the face, `tooltip` replaces its tooltip, `active` holds it down (in a palette, marks the current tool with `aria-current`), and `popup` says it opens a dialog or a menu. Every one takes `disabled` and `disabledReason`, and the `Disabled` scope. `ToolButton`'s `ariaDisabled` is gone: a `disabledReason` keeps a button reachable.

```tsx
// before
<Bar.Button iconOnly title="Undo" pressed={on} onClick={undo}>{undoIcon}</Bar.Button>
<ToolButton icon={selectIcon} label="Select" active onClick={pick} />
<BarActionButton label="Join" icon={joinIcon} menu onPress={join} />
// after
<ActionButton icon={undoIcon} label="Undo" active={on} onPress={undo} />
<ToolGroup><ActionButton icon={selectIcon} label="Select" active onPress={pick} /></ToolGroup>
<FormScope form="menu"><ActionButton label="Join" icon={joinIcon} onPress={join} /></FormScope>
```

<!-- entry: rank=10 breaking api visual -->
