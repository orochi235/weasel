# Fallthrough diagram for real dispatches

Status: **design, unbuilt** (2026-09-27).

For whoever builds it. It answers: how does the inspector show, for one real
input, which bindings matched, what the filters dropped, how the rest were
ranked and why, and what the walk did — and what has to change in the
dispatcher so that picture cannot disagree with what ran.

The static version of this picture is `docs/diagrams/precedence-fallthrough.svg`
(the rules); this draws one input's actual candidates against them.

## What exists

| Piece | Shows | Missing |
|---|---|---|
| `DispatchTracePanel` (apps/draw dev) | Each real dispatch after the fact: candidates, tier, `enabled()` result, winner | Routes, specificity, filter drops, why the order is what it is |
| Resolution widget in `ToolkitBuilder` | `resolveAll`'s ranked walk with specificity and reasons | Its input is hand-built and its deps are stubbed, so `enabled()` reasons are guesses and eligibility is skipped |

`handleInput` and `resolveAll` are two separate walks over the same candidates
today, and every change to ranking has to be made in both.

## The record

`DispatchRecord`, exported from `@weasel-js/routing`, one per input the
dispatcher resolves:

| Field | Holds |
|---|---|
| `input` | Event kind, key or button, modifiers held, routed view id, world point, mode |
| `matched` | Every binding whose spec matched: route (`routesForSpec`), action id, owning tool, tier, whether it names the view, specificity, `eligible` rule text |
| `dropped` | Candidates each filter removed, with the filter (`claim` with the claim's owner, or `ineligible` with the rule text) |
| `ranked` | The surviving order; each entry names the step that placed it below the one before (`view`, `tier`, `specificity` with the deciding part, `context`, `order`), and the first entry says `first` |
| `walk` | Per candidate: `fired`, `declined` (with the `enabled()` reason), `empty-handle`, `duplicate`, `no-such-action`, `not-asked`, or — in a predicted record — `would-fire` |
| `predicted` | True when nothing was invoked |
| `outcome`, `fired` | As in today's trace entry |

`matchSorted` returns the bindings the exclusive claim barred alongside its
matches, so `dropped` can report them.

## One walk

Matching, both filters, ranking and the verdict walk become one function that
fills a record. `handleInput` is that walk with an invoke step; `resolveAll`
and `resolveOnly` keep their signatures and read their answers off the same
record. The order a prediction shows and the order a dispatch uses are then the
same computation. A predicted record never calls `start()`, so an ongoing
winner there is `would-fire`, not a claim that it engaged.

## Cost

Records are built in dev builds only, as the trace is today; production passes
a recorder that does nothing. They replace `DispatchLogEntry` in the existing
trace buffer, which is capped at 200 entries, so memory stays bounded where it
already is.

## The component

`<FallthroughDiagram record>` in `@weasel-js/ui`, beside `GestureRoute`, which
draws each route. Top to bottom: the matched set; a band per filter listing
what it dropped and why (or saying it dropped nothing); the ranked list, each
row showing route, tier, specificity, rule and a placed-by badge; the walk,
with the winner marked. It takes a plain record, so it has its own stories
built from fixture records. Mockup: `fallthrough-mock.html` on the transom
wall, zone `weasel`.

## The inspector

- Clicking a row in `DispatchTracePanel` opens that dispatch's diagram.
- A pinned "Live" row shows the predicted record for a press at the pointer.
  The hover-cursor pump in `useGestureDispatcher` already resolves that on
  every move; in dev it publishes its record to a live slot the panel reads,
  at most once per frame.

## Tests

- Record tests for the two worked examples in the static diagram (Escape in
  path edit; a bare drag with the select tool active), asserting every field.
- Consistency: for each scenario, the action `handleInput` fires equals the
  record's winner and `resolveAll`'s winner.
- A claim-filter case, so `dropped` is exercised.
- Component tests and stories; a browser screenshot of the inspector showing a
  real dispatch.
