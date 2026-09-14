---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`ComboBox` can take its options from a server, and a new `useAsyncOptions` hook
does the fetching.

**`useAsyncOptions({ load, debounceMs, minLength })`** returns `{ options,
isLoading, loadError, inputValue, onInputChange }`, shaped to spread into a
`ComboBox`. It debounces the query, aborts a request superseded by a later
keystroke, and reports a rejected load separately from an empty result. Its
race guard is a sequence number rather than a liveness flag: two requests from
adjacent keystrokes are both live, so a flag cleared by effect cleanup does not
stop a slower first response from overwriting a newer one. `options` holds the
last *resolved* list and is never emptied to mean "working", so the previous
rows stay on screen and stay arrowable while the next request is out.

**`ComboBox` gains four props.** `filter` is `'contains'` (the default, and
today's behavior), `'none'`, or a predicate. `'none'` shows every option given —
what a list a server already ranked needs, since React Aria's own substring pass
would drop rows that do not contain the query and reorder whatever survived. It
also implies `allowsEmptyCollection`, because a list the kit does not filter can
arrive empty mid-query and the popover would otherwise close before `emptyLabel`
could be seen. `isLoading` marks the field pending with `aria-busy` and a
spinner. `loadError` shows the new `errorLabel` in place of `emptyLabel`.
`onCommit` fires on Enter and on click with `{ source: 'option', key }` or
`{ source: 'text', text }`, so a consumer that accepts custom values no longer
has to reassemble "the user committed something" from two callbacks and a key
press.

`ComboBox` also has keyboard tests for the first time — real key presses
asserting that the arrows move the active option and that Enter commits it.
