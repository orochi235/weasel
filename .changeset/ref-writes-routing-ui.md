---
"@weasel-js/routing": patch
"@weasel-js/ui": patch
"@weasel-js/forge": patch
"@weasel-js/diagram": patch
---

Refs that event handlers, timers and message listeners read no longer hold
what an abandoned concurrent render computed. The gesture dispatcher,
`useDepSource`, `useOngoingAction`, `ActionsProvider`, `useTools`,
`useContributions`, the ui components with drag or dismissal handlers
(`Callout`, `CurveEditor`, `LayerList`, `ResizeHandle`, `Timeline`'s graph
lane), `useAsyncOptions`, `useReorderDragList`, forge's trial shell and
`useLiveLayout` now publish their latest props on commit only.

`ContributionsApi` is now rebuilt from each render's entries instead of reading
them through a ref, so its `entries`, `overlays()` and `scopedBindings()` answer
correctly when read during render. Its identity is kept while the entry list
holds the same entries, and changes when an entry is added, removed or
replaced — a consumer building its entry objects inline every render now gets a
new API object each render.

Because a dep source now publishes on commit, `ActionBar` re-checks each
action's `enabled` after it commits and re-renders if a dep changed in the same
render.
