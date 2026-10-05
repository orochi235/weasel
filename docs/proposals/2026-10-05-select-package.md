# `@weasel-js/select`: one selection model

**Status: built on the `select-package` branch, not merged.** Delete this once it merges; the
package README carries the rules. "Not in this change" below is what stays open.

For whoever works on selection anywhere in weasel, canvas or list. It answers: where the rules for
"what does this click do to the selection" live, and why they are their own package.

## The problem

The same question — given what is selected and a press with these modifiers, what is selected
now — was answered three times, three different ways:

| | plain press | shift-press | Cmd/Ctrl-press | shift+arrow | locked / disabled |
|---|---|---|---|---|---|
| core `useSelection`, multi | replace | toggle (default extend key) | — | — | not modeled |
| ui `Tree` | replace | range from anchor | toggle | — | skipped in a range |
| ui `LayerList` | replace | toggle | — | range from anchor | never joins a multi-selection |

`Tree` and `LayerList` each kept their own anchor ref and their own range walk. Neither used
core's model, and core's model had no anchor or range, because a canvas has no order.

## The model

`@weasel-js/select` is pure functions over a value, with no React and no DOM, like `history`:

- **`Selection<K>`** — `{ ids, anchor }`. The anchor is the end a range extends from.
- **`intentOf(modifiers, policy)`** maps a press to `'replace' | 'toggle' | 'range'`. The policy
  names which key toggles and which key ranges, so a surface states its convention instead of
  hard-coding one. Single mode always replaces; a range key beats a toggle key when both are held.
- **`select(state, id, intent, context)`** applies it. `context.order` is the sequence a range
  walks; `context.eligible` says which ids may join a multi-selection.
- **`createSelectionStore`** and the `SelectionStore` contract it satisfies, so a selection can
  live outside a hook — what `Scene` already implements.

The rules `select` applies:

| intent | ids | anchor |
|---|---|---|
| `replace` | `[id]` | `id` |
| `toggle` | eligible ids, with `id` added or removed; `[id]` if `id` is ineligible | `id` |
| `range` | eligible ids from anchor to `id` in `order`; unchanged if none are eligible; `[id]` if there is no anchor or either end is not in `order` | unchanged |

`SelectionMode` and `SelectionExtendKey` move here from `@weasel-js/routing`, which re-exports
them, so the policy vocabulary has one definition. `SelectionApi` stays in routing: it is the
`selection` dep's contract, typed in `NodeId`.

## Who uses it

- core `useSelection`: `applyClick` is `intentOf` + `select` with the hook's mode and extend key,
  and its local store is `createSelectionStore`. Behavior unchanged.
- `Tree`: policy `{ toggle: ['meta', 'ctrl'], range: 'shift' }`, order = visible rows, eligible =
  not disabled. Behavior unchanged.
- `LayerList`: policy `{ toggle: 'shift' }` for a press, intent `'range'` for shift+arrow,
  eligible = not locked. One edge changes: shift+arrow with the anchor in a collapsed branch used
  to do nothing, and now selects the row arrived at.

## Not in this change

- **Range on the canvas.** A canvas has no order of its own. Supplying one (z-order, tree order,
  a layer panel's row order) is a design question; `select` already takes the order as input.
- **`LayerList`'s shift-press toggles, where `Tree`'s ranges.** Finder and most layer panels
  range on shift and toggle on Cmd. `LayerList` mirrors the canvas convention instead. Its policy
  is now one line to change, but which convention a layer panel should follow is a decision.
