# Review saturation for `labkit.chrome`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 22 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Header shortcut subscriptions and server rendering | 1 | 1 | 0 |
| 2 | Sidebar region routing and custom render contributions | 1 | 2 | 0 |
| 3 | Toolbar menus, titlebar placement, and overlays | 0 | 2 | 1 |
| 4 | Built-in tool visibility and shortcut selection | 0 | 2 | 2 |
| 5 | Contribution merge, settings export, and region styles | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Lab header shortcut lookup throws during server rendering

[LabChrome.tsx](packages/labkit/src/chrome/LabChrome.tsx#L116) · Pass 1 · medium · Source-traced

LabHeaderRegion always calls useBoundShortcuts, which gives useSyncExternalStore a subscription and client snapshot but no server snapshot. Server rendering therefore throws before it can render the toolbar, even for an empty contribution list or a header outside an actions provider.

### 2. Custom-rendered contributions bypass sidebar region selection

[SidebarRegion.tsx](packages/labkit/src/chrome/regions/SidebarRegion.tsx#L127) · Pass 2 · low · Source-traced

SidebarRegion renders any contribution with a render callback before comparing its region to the requested region. SidebarPanes has the same ordering in its inclusion predicate. An app using these exported components with a mixed collection can render a status or aside contribution in the sidebar, and in SidebarPanes the foreign contribution can take up pane height. Lab's built-in callers avoid this by prefiltering.

Source and tests were left untouched.
