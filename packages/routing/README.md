# @weasel-js/routing

Binding-to-action routing for the weasel canvas kit: the gesture dispatcher,
the action registry and invoker, tool and contribution declaration, the
route grammar's reflection surface, and the eligibility rule algebra.

Routing is the part of the kit that decides *which action a gesture runs*. It
knows nothing about what an action does to a scene — actions themselves, the
scene graph, the renderer and the concrete dependency interfaces all live in
`@weasel-js/core`, which consumes this package and re-exports its surface.

## Two entry points

- `@weasel-js/routing` — the pure half. No React, no DOM: the dispatcher, the
  matcher, the rule algebra, the action and tool types, the invoker.
- `@weasel-js/routing/react` — the React seam. `useGestureDispatcher` and the
  providers that feed it (`ActionsProvider`, `DepRegistryProvider`,
  `useTools`, `useContributions`). React is an optional peer.

## The dependency schema

`DepSchema` is declared here as an empty interface. Everything that names a
dependency — `Action.requires`, `DepRegistry.get`, `useDepSource` — is keyed on
`keyof DepSchema`, so the set of legal names is whatever has been merged into
it. `@weasel-js/core` merges the kit's own 24 deps; a consumer adds its own the
same way:

```ts
declare module '@weasel-js/core' {
  interface DepSchema {
    color: ColorApi;
  }
}
```

The augmentation merges through core's re-export, so consumers keep naming
`'@weasel-js/core'` and never have to know this package exists.
