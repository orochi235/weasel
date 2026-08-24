---
'@weasel-js/core': patch
---

Let a view answer any dep for itself, not just `view`.

A dispatcher view record carried a `ViewApi`; it now carries a thunked
`Partial<DepSchema>`, and an event routed to that view resolves every name in
it from the view, everything else from the canvas registry. `view` becomes one
entry rather than a special case, which is what per-view selection needs next.

This is also the answer to whether a view should get a `DepRegistryProvider` of
its own: it should not. The registry is where a consumer registers *sources*,
and one per view would fragment that — overriding `insert` would mean knowing
how many views exist and overriding each. An overlay keeps one place to
register and one authority per dep, with a view claiming only what is genuinely
its own.
