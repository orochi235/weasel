# Async options for ComboBox

**What this is:** the surface a `ComboBox` needs when its options come from a
server rather than an array in the caller's hand, plus the hook that owns the
fetching.

**Who it is for:** whoever builds a search-as-you-type field on
`@weasel-js/ui`. The first one is a part search over ~20,000 LDraw parts in the
brick-icons lab, but nothing here is domain-specific.

**What it answers:** `ComboBoxProps.options` is a `ReadonlyArray` held in
memory, and React Aria filters it with a locale-aware substring match. Neither
survives a remote corpus: the caller has no way to say "these arrived just now,
and they are already ranked."

## The two halves, and why they are two

Fetching and displaying are separate concerns with different reuse. The
debounce, the race guard and the error channel are wanted by anything that
searches — a `Select`, a command palette, a filter box that drives no popup at
all. The loading row and the empty state are `ComboBox` chrome. So the fetching
is a hook usable on its own, and `ComboBox` learns only what it must to display
what the hook produces.

A consumer that already holds its options does not touch the hook. That is the
common case and it keeps working untouched.

### `useAsyncOptions`

```ts
function useAsyncOptions<T extends Key = string>(opts: {
  load: (query: string, signal: AbortSignal) => Promise<ReadonlyArray<ComboBoxOption & { value: T }>>;
  debounceMs?: number;
  minLength?: number;
}): {
  options: ReadonlyArray<ComboBoxOption & { value: T }>;
  isLoading: boolean;
  loadError: unknown | null;
  inputValue: string;
  onInputChange: (next: string) => void;
};
```

`debounceMs` defaults to 150 and `minLength` to 0. Below `minLength`, `load` is
not called and `options` empties.

`options` holds the **last resolved** set, never an empty array placed there to
mean "working". That single choice is what produces the stale-results behavior
below without a special case for it.

**The race guard is a sequence number, not a liveness flag.** A captured
`let live = true` cleared by effect cleanup only rejects a response whose
cleanup has already run. Two requests in flight from adjacent keystrokes are
both live, so the slower first one wins if it lands second, and the field shows
results for a prefix of what the user typed. Each request instead takes a
monotonic number, and a response is applied only if its number is the highest
yet seen. Superseded requests are also aborted through their `AbortSignal`
rather than merely ignored, so a slow corpus does not accumulate sockets.

**`loadError` is a channel, not a log.** A rejected `load` must be
distinguishable from a corpus that genuinely holds no match, because the two
call for different words on screen and only one of them means "try a different
query."

### What `ComboBox` gains

**`isLoading`** renders a pending affordance in the field. It marks the
existing list as out of date; it does not replace it.

**`loadError`** renders an error row in place of the empty state.

**`filter`** becomes `'contains' | 'none' | ((textValue, inputValue) => boolean)`,
defaulting to `'contains'` — today's behavior, unchanged for every current
caller. `'none'` hands React Aria a filter that admits everything.

`'none'` also sets `allowsEmptyCollection`. These are one decision, not two: a
list the kit does not filter can arrive empty from the server on a query the
user is still typing, and without `allowsEmptyCollection` React Aria closes the
popover instead of showing `emptyLabel`. Leaving them separable means shipping a
combination whose only behavior is a bug.

**`onCommit`** fires on Enter and on click:

```ts
type ComboBoxCommit<T> =
  | { source: 'option'; key: T }
  | { source: 'text'; text: string };
```

`onSelectionChange` and `onInputChange` remain, and remain the way to observe
the halves separately. `onCommit` exists because "the user committed something"
is otherwise assembled at each call site from two callbacks and a key press,
and the assembly is where the double-fire lives.

## Why a server's ranking must survive

React Aria filters the collection it is given, with `contains` from `useFilter`
— an `Intl.Collator` substring scan, case- and diacritic-insensitive, preserving
the caller's declared order. Against a local array that is exactly right.

Against a ranked remote result it is destructive twice over. A server that
matches `"brick 2 x 4"` as a set of words, or ranks an id prefix above a
description hit, returns rows that do not contain the typed string as a
substring at all; `contains` drops them. What survives is then reordered into
declaration order, discarding the ranking that was the point of asking a server.

This is not hypothetical: the part index's own matcher buckets hits as exact id,
then id prefix, then an AND-of-all-words scan over `"{id} {description}"`, and
sorts that last bucket by whether the description matches as a phrase or as
scattered words. Two of those three tiers produce rows `contains` would discard.

## Behavior across the async states

| state | list | field |
|---|---|---|
| nothing typed yet | whatever `minLength` implies: with `0`, the result of `load('')`; above it, empty | — |
| request in flight | previous results, still arrowable | pending affordance |
| resolved, hits | the new results | — |
| resolved, zero hits | `emptyLabel` | — |
| rejected | `errorLabel` | — |

Holding the previous results is the deliberate choice. Emptying the list on each
keystroke costs the user their arrow-key position 150ms after every character,
and at a debounce plus a round trip that reads as a strobe. The pending
affordance is what keeps it honest: the rows are visibly not yet an answer.

## Not in scope

**Match highlighting.** Under `filter="none"` the kit does not know which span
matched — the server does, and it says nothing about it. Highlighting therefore
needs its own answer (a match range on the option, or a highlight function), and
folding it in here would settle that question by accident.

**Virtualization.** The popover caps at 280px of scroll and the first consumer's
server caps at 25 rows. There is no list long enough to need it.

**Multi-select.** React Aria supports it; this wrapper pins single selection and
neither consumer wants otherwise.

## Testing

Tests sit beside the component and run under the `weasel-ui` vitest project.
`CSS.escape` is polyfilled in `vitest.setup.ts` — that polyfill is what lets a
React Aria popover open under jsdom at all, and without it these tests fail on
a throw rather than an assertion.

The hook is testable directly and deserves the harder cases: a superseded
response landing after its successor is discarded, a rejected load populating
`loadError` while leaving the previous `options` intact, and `minLength`
suppressing the call rather than calling with a short string.

`ComboBox` has no keyboard test today, and the keyboard behavior this design
leans on is React Aria's. So the tests worth adding are the ones that fail if
the wiring is wrong — real `userEvent` key presses asserting that arrowing moves
the active option and that Enter commits the active one, not a re-assertion that
React Aria works.

**One assertion not to write.** `scrollIntoView` is a no-op under jsdom, so
"the active row is visible" cannot fail there and any test of it asserts the
emulation. That behavior needs a browser or nothing.

## Consumers

Both live in brick-icons, in a later change, and both replace hand-rolled
pickers whose keyboard handling is a strict subset of React Aria's.

`PartSearch` is the hook's first consumer: query-driven, `filter="none"`,
`allowsCustomValue`, and `onCommit` covering both its paths — Enter on a raw
part id, and clicking a hit.

`ColorField` does **not** use the hook. Its palette is fetched once and filtered
locally, which is `options` plus the default `'contains'` — the path `ComboBox`
already serves. It becomes a consumer by deleting its own listbox, not by
gaining async.

**A prerequisite for seeing either run:** the lab aliases only
`@weasel-js/core` and `@weasel-js/labkit` to a local weasel checkout under
`WEASEL_SRC`. `@weasel-js/ui` is not in that list, so an unreleased `ComboBox`
cannot reach the lab until it is.
