---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`SidebarPanel` folds through `collapsed`, `defaultCollapsed` and `onCollapsedChange(next)`, as `PropertyGroup` does, in place of `onToggleCollapse()`.

`defaultCollapsed` lets the panel hold its own fold. `collapsible={false}` keeps a panel given `collapsed` from drawing the toggle.

```tsx
// before
<SidebarPanel title="Layers" collapsed={folded} onToggleCollapse={() => setFolded(!folded)} />
// after
<SidebarPanel title="Layers" collapsed={folded} onCollapsedChange={setFolded} />
```

<!-- entry: breaking api -->
