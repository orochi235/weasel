---
'@weasel-js/ui': minor
'@weasel-js/labkit': minor
---

New `<Disabled when reason>` disables every kit control inside it; a container's `disabled` and `disabledReason` do the same.

`Bar`, `BarLayout`, `Toolbar`, `ToolbarGroup`, `ToolGroup`, `ToolRail`, `ToolPalette`, `ToggleBar`, `OptionsBar`, `ButtonBar`, `PropertyPanel`, `PropertyGroup`, `Subpanel`, `PropertyRow`, `PrefsForm`, `SelectionPanel`, `SidebarPanel`, `StatusBar`, `ToolOptionsBar`, `ActionBar`, and labkit's `ControlPanel` take them, as a `<fieldset disabled>` would. An inner `disabled={false}` adds nothing. The nearest reason wins, and a control's own `disabledReason` beats a scope's. With no reason a control is natively disabled; with one it stays focusable, ignores presses, and its tooltip and description say why, React Aria fields included. `useDisabled(own)` reads the result for a control of your own.

```tsx
<Disabled when={locked} reason="The layer is locked">
  <PropertyPanel title="Stroke">…</PropertyPanel>
</Disabled>
```

<!-- entry: rank=10 new api -->
