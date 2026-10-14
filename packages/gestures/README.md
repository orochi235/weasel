# @weasel-js/gestures

The vocabulary weasel uses to say which user input fires what, and the pure
functions that decide whether an input matches. It has no React, no scene, and
no dependencies, so it can run in a test, a worker, or a host that is not
weasel at all.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/gestures).

## Install

```sh
npm install @weasel-js/gestures
```

## Terms

These words have fixed meanings across weasel:

- A **gesture** is a form of input: a click, a drag, a wheel turn, a keystroke,
  a pinch, a file dropped on the canvas.
- An **action** is a user-intent operation: move, delete, zoom in.
- An **interaction** is a gesture bound to an action: "shift-click on empty
  canvas adds to the selection".

This package covers the gesture side only. It describes gestures, recognizes
them from raw pointer input, and matches them against descriptions. Actions,
and the dispatcher that runs the action a matched gesture is bound to, live in
other weasel packages.

## What is in it

### Describing a gesture

A `GestureSpec` is an object describing one gesture a binding listens for:
its `kind` (`'click'`, `'drag'`, `'key'`, `'wheel'`, and so on), and optionally
the modifier keys that must be held, what the pointer must be over, and the
phase the owning tool must be in.

A **route** is the same description as a string, short enough to write inline
and to show in a shortcut list: `[initial] click => empty +shift`.

`parseRoute` turns a route into a `ParsedRoute`, `formatRoute` writes the
canonical string back, `routeToSpec` converts a parsed route into the
`GestureSpec` the matcher takes, and `describeRoute` renders it as an English
sentence. `GESTURE_DESCRIPTORS` is the table of gesture names the grammar
accepts, with whether each takes a target and what argument it carries.

### Matching input against a description

An `InputEvent` is one normalized input: a union keyed by `kind`, each arm
carrying the modifier state and whatever that kind of input reports.

`matchSpec(event, spec, isMac)` returns whether an event satisfies a spec.
Its parts are exported too: `matchModifiers`, `matchKey`, `matchTarget`, and
`matchPhase`. When several specs match one event, `specificity(spec)` gives a
tuple to rank them by, so the narrower description wins.

### Recognizing gestures from pointer input

`createPointerRecognizer` turns a stream of pointer presses, moves, and
releases into `InputEvent`s. It decides when a press has moved far enough to be
a drag, when a release in place is a click, when two clicks make a double
click, when a held touch is a long-press, and when several pointers form a
multitouch gesture. It touches no DOM: the host feeds it samples and supplies
the clock, and it hands each recognized event to a sink the host provides.

The thresholds it uses are exported as constants: `DRAG_THRESHOLD_PX`,
`LONG_PRESS_MS`, `DOUBLE_CLICK_MAX_MS`, `DOUBLE_CLICK_MAX_PX`, and
`TAP_THRESHOLD_PX`.

### How they fit together

| From | Through | To |
|---|---|---|
| Pointer samples | `createPointerRecognizer` | `InputEvent` |
| Route string | `parseRoute`, then `routeToSpec` | `GestureSpec` |
| `InputEvent` and `GestureSpec` | `matchSpec` | `true` or `false` |

A host listens to the DOM, feeds pointer samples to a recognizer, and builds
key, wheel, and drop events itself. Each binding carries a `GestureSpec`,
written directly or parsed from a route. For every event, the host asks
`matchSpec` which bindings apply, ranks them with `specificity`, and runs the
winner's action.

The package also exports a few helpers a host needs while doing this:
`isApplePlatform` to decide what the `mod` modifier means, and
`isEditableTarget`, `focusedControlOwnsKey`, and `isInControlWithin` to leave
keys and presses alone when they belong to a text field or a button.

## Example

Parse a route, turn it into a spec, and test an event against it:

```ts
import {
  describeRoute, matchSpec, parseRoute, routeToSpec, type InputEvent,
} from '@weasel-js/gestures';

const route = parseRoute('[*:*] click => empty +shift');
const spec = routeToSpec(route);
// { kind: 'click', target: 'empty', mods: { shift: true } }

const shiftClick: InputEvent = {
  kind: 'click',
  bodyTarget: 'empty',
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: true,
};

matchSpec(shiftClick, spec, false);                       // true
matchSpec({ ...shiftClick, shiftKey: false }, spec, false); // false: shift is required

describeRoute(parseRoute('[initial] drag +mod ?shift'));
// 'Fires when the user Mod-drags anywhere, while the tool is idle (Shift optional).'
```

Modifier matching is strict. A modifier the spec does not mention must not be
held, so a spec for plain `click` does not match a shift-click. Mark a modifier
`?shift` in a route, or `shift: 'optional'` in a spec, to accept it either way.

## License

MIT
