# Labkit — Recipes

Composition patterns for common lab shapes. This file grows as plans land.

## Plan 1 recipes

### A minimal lab shell with a tiled grid

```tsx
import { LabShell, WorkspaceGrid } from '@labkit/react';
import '@labkit/react/styles.css';

export function MyLab() {
  return (
    <LabShell title="My Lab">
      <WorkspaceGrid>
        <div>Workspace 1</div>
        <div>Workspace 2</div>
        <div>Workspace 3</div>
      </WorkspaceGrid>
    </LabShell>
  );
}
```

### A toolbar with undo/redo and a save button

```tsx
import { Toolbar } from '@labkit/react';

<Toolbar>
  <Toolbar.Title>My Workspace</Toolbar.Title>
  <Toolbar.Button onClick={onUndo} disabled={!canUndo}>Undo</Toolbar.Button>
  <Toolbar.Button onClick={onRedo} disabled={!canRedo}>Redo</Toolbar.Button>
  <Toolbar.Spacer />
  <Toolbar.Button onClick={onSave}>Save</Toolbar.Button>
</Toolbar>
```

### A status bar with multiple sections

```tsx
import { StatusBar, FpsMeter } from '@labkit/react';

<StatusBar>
  <StatusBar.Section>Items: {items.length}</StatusBar.Section>
  <StatusBar.Section>Zoom: {Math.round(zoom * 100)}%</StatusBar.Section>
  <StatusBar.Section><FpsMeter /></StatusBar.Section>
</StatusBar>
```

(More recipes added in subsequent plans — Lab/Workspace integration, undoable actions, custom storage, etc.)
