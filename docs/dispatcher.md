# The gesture dispatcher, in diagrams

For anyone changing or debugging input routing: how one input becomes one
action, which binding wins when several match, and which canvas's registries
answer. The rules themselves are in [taxonomy.md](./taxonomy.md#interaction)
(the precedence table) and [taxonomy.md](./taxonomy.md#input-scope-and-yoke)
(scope tiers); these pictures show how they fit together.

Each SVG is drawn by the script of the same name in `diagrams/src/`; edit the
script and rerun it rather than editing the SVG
(`python3 docs/diagrams/src/input-scopes.py docs/diagrams/input-scopes.svg`).

The code is `packages/routing/src/interactions/dispatcher/` (`useGestureDispatcher.tsx`,
`dispatcher.ts`, `matcher.ts`) and `packages/routing/src/interactions/actions/`
(`inputScope.tsx`, `scopeNode.ts`).

## One input, end to end

![Dispatch pipeline](./diagrams/dispatch-pipeline.svg)

Steps 1 and 2 happen in the React seam, the rest in the pure dispatcher. The
green boxes are what the canvas's input scope supplies. When an input goes
unhandled, the three red exits say where to look. `Dispatcher.resolveAll`
replays steps 4 to 7 without invoking anything, and gives each candidate a
verdict. Dispatch and prediction share one walk, so the two cannot disagree.

For one real input, the dispatcher's `DispatchRecord` holds every binding that
matched, what the claim and eligibility filters dropped, the ranked survivors
with the step that placed each, and what the walk did with each. In dev builds
every dispatch leaves one in the trace buffer, and `Dispatcher.explain` builds
one without invoking anything. `FallthroughDiagram` (`@weasel-js/ui`) draws a
record. apps/draw's dispatch trace opens it from any row, under a Live row
that predicts a press at the pointer.

## Which binding wins

![Precedence, as a fallthrough diagram](./diagrams/precedence-fallthrough.svg)

The example routes are written in the route grammar that `parseRoute` and
`formatRoute` read and print, defined in
[`packages/gestures/src/grammar/routeGrammar.ts`](../packages/gestures/src/grammar/routeGrammar.ts).

Read it top to bottom, the order the candidate list ends up in.
Naming the routed view outranks the scope tier (see `BindingOpts.views`), so
it comes first. The two examples show the usual pattern: a step decides the
order, and `enabled()` still gets the last word as the walk moves
down the list.

## Whose registries answer

![Input scopes](./diagrams/input-scopes.svg)

Follow the amber path to see what chrome at the root is talking to, and the
dashed green arrows to see what a canvas can see. A pointerdown or wheel is
what moves the amber path. That is why a keystroke goes to the canvas you last
clicked in, not the one under the pointer.
