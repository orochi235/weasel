# Prefs rail layout

A second layout for `PrefsForm`: a two-level navigation rail down the left, one
group's settings in the pane beside it, and an optional filter field that
narrows both. For anyone building a preferences surface on `@weasel-js/ui` —
and for the kit's own `PrefsDialog`, which today can only lay its groups out as
columns.

## Why

`PrefsForm` renders every top-level group as a 300px column, wrapping. In a
dialog capped at 900px that reliably overflows: the `InDialog` story scrolls
*horizontally* at two columns, each column is a sunken card drawn on a surface
that already has a border, and a nested group is a third box inside the second.
The control slot is pinned at 110px, so sliders and selects stay stubby while
the label rail keeps space it does not use.

A rail replaces all of that structure with one piece of chrome. The pane below
it holds flat rows, no cards, and the control track takes whatever width is
left.

## Surface

Two new props on `PrefsForm`, and the section state that the rail needs:

```ts
layout?: 'columns' | 'rail'        // default 'columns' — today's behavior
filterable?: boolean               // default false; honored in both layouts
section?: string                   // controlled: path of the open top-level group
defaultSection?: string
onSectionChange?: (path: string) => void
```

`'rail'` rather than `'sidebar'`: the kit already has a `Sidebar` component,
and this is not it.

`PrefsDialog` grows a `footer` passthrough to `Dialog` — a preferences dialog
wants a "Reset to defaults" rail along the bottom, and routing that through
`headerExtra` is what puts a button in the middle of the heading today. The
`titleRow` rule is also corrected to push `headerExtra` to the end rather than
letting it sit beside the title.

## Structure

The rail is two levels deep whatever the schema does. Depth-0 groups switch the
pane. Depth-1 groups scroll the pane to their section and light up as it passes.
Depth 2 and beyond render as indented sub-sections inside the pane with no rail
entry at all — an arbitrarily deep schema cannot grow an arbitrarily deep rail.

**`PrefsRail`** — a `<nav>` holding a flat list of buttons, not a tablist. Only
the depth-0 entries switch panes; the depth-1 entries are scroll targets within
one, and tab semantics describe neither. Depth-0 carries `aria-current="page"`
when open, depth-1 `aria-current="location"` when its section is the one in
view. `useRovingTabIndex` (already in the package) handles arrow-key movement
over the flattened list.

**`PrefsPane`** — `role="region"`, labeled by the open group. Renders the
group's own leaves first, then one `<section>` per depth-1 child with a sticky
heading. Switching groups resets the pane's scroll to the top.

**`useScrollSpy`** — new hook in `packages/ui/src`, general: section element ids
plus the scrolling container, returning the id of the topmost section in view.
It reads positions on the container's `scroll` event rather than through
`IntersectionObserver`, and the decision itself is a pure function
(`pickActiveSection`) taking measured offsets. A rail click scrolls the pane and
suppresses spy updates until the scroll settles (`scrollend`, with a timeout
fallback), so the click does not fight the observation it causes.

Loose top-level leaves are legal in a schema today — each currently gets its own
column. In rail layout they collect under a single leading rail entry labeled
with the schema root's `name`, present only when such leaves exist.

## Filtering

`filterPrefSubtree(node, query)` joins `visiblePrefSubtree` in `schema.ts` and
has the same shape: case-insensitive substring over each leaf's `name`,
`description` and path segments; a group whose own name matches keeps all of its
leaves; groups left empty are pruned. `prefRailItems` carries a per-group match
count alongside.

The field renders at the top of the rail in rail layout, above the columns
otherwise. Groups with no matches drop out of the rail rather than dimming, and
each surviving entry shows its count. If the open group stops matching,
selection moves to the first group that still does. With nothing matching at
all, the pane says so and offers to clear the field.

## Tokens and CSS

`--wzl-prefs-rail-width` (default 216px), beside the existing
`--wzl-prefs-column-width`. The rail sits on `--wzl-surface-sunken` with one
right border; the pane is flat on the dialog's own surface. No panel cards
anywhere in this layout. Rows become a two-column grid —
`minmax(140px, 240px) minmax(180px, 1fr)` — so the control track grows with the
dialog instead of holding at 110px. The columns layout keeps its current rules
untouched.

## Testing

The parts with a decidable answer get unit tests in the `weasel-ui` project:
`filterPrefSubtree`'s matching, pruning and counts; `prefRailItems` against a
three-deep schema, proving depth ≥ 2 stays out of the rail; selection moving
when the open group is filtered away; the root-named entry appearing only when
loose leaves exist; and `pickActiveSection` over measured offsets.

`useScrollSpy`'s wiring is not decidable in jsdom — no layout, so every
`getBoundingClientRect` is zero and a spy that never fires looks identical to
one that works. Following the repo's own note on this, the component test
asserts only that the hook subscribed to the container's scroll, says in the
test that it is a proxy for the behavior, and leaves the behavior itself to a
forge story and a visual baseline of the rail dialog. A jsdom suite cannot see a
collapsed flex row either, which is the other reason the baseline exists.
