# weasel-ui

UI chrome primitives for weasel-based apps — selection-aware property
panels, toolbar shells, etc. Sibling to `@orochi235/weasel`; consumed
today only by the swillustrator demo via a vite alias (no workspaces
yet).

## What's here

- `<PropertiesPanel>` — sidebar shell with title + 12-column grid.
- `<PropertyRow>` — label-in-column-1 + value-cells layout helper.
- Input primitives — `PropertyTextInput`, `PropertyNumberInput`,
  `PropertyAxisInput` (X/Y or W/H pair), `PropertyColorInput`,
  `PropertySelect`, `PropertyButton`, `PropertyReadOnly`.
- `tokens.css` — neutral CSS-variable defaults. Apps either import this
  or define the variables themselves.

## CSS variables

Components read these (defaulted in `tokens.css`):

| Variable | Purpose |
|---|---|
| `--wui-text` | Primary text |
| `--wui-text-muted` | Labels, secondary text |
| `--wui-panel-bg` | Panel background |
| `--wui-panel-border` | Panel/input border |
| `--wui-input-bg` | Input field background |
| `--wui-accent` | Focused-input border, primary action |
| `--wui-danger` | Destructive button text |

## Why a separate package

The peer-package layout matches `docs/specs/2026-05-03-weasel-den-design.md`:
core stays focused on primitives, finished tools migrate to weasel-den,
and UI chrome lives here. Today only this package exists; weasel-den is
a placeholder. Full monorepo conversion (moving core into
`packages/weasel/`, declaring workspaces, etc.) is deferred.
