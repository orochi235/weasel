# Review saturation for `prefs-editor.PrefSchemaEditor.part1`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 36 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Empty catalog affordances and icon option identity | 2 | 2 | 0 |
| 2 | Asset selection, structure keyboard actions, and read-only routing | 0 | 2 | 1 |
| 3 | Preview scene defaults, number entry and unit attribute controls | 0 | 2 | 2 |
| 4 | Export state, shelf placement and editor layout | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An empty editable action catalog hides the control for adding a group

[Shelf.tsx](packages/prefs-editor/src/PrefSchemaEditor/Shelf.tsx#L69) · Pass 1 · P2 · Source-traced

Open a PrefSchemaEditor with an editable action catalog containing zero children, or remove its last child. The shelf hides the Actions pane whenever the catalog root is empty. Add action group is inside that pane, so the editor offers no way to create the first group or recover the pane by adding another.

### 2. Distinct icons can share the same active-descendant ID

[IconPicker.tsx](packages/prefs-editor/src/PrefSchemaEditor/IconPicker.tsx#L16) · Pass 1 · P3 · Source-traced

Register icons named demo:dash-name and demo:dash_name. Both option IDs normalize to the same string because non-word characters are replaced by underscores. Keyboard navigation can highlight the second option while the listbox's aria-activedescendant still identifies the first duplicate ID to assistive technology.

Source and tests were left untouched.
