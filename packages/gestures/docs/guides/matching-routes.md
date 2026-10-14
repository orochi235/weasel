# Writing and matching routes

A route is a string that describes one gesture a binding listens for, such as
`[initial] click => empty +shift`. A gesture is a form of input: a click, a
drag, a keystroke. This guide covers how to write a route, how to turn it into
the `GestureSpec` object the matcher takes, how to test an input event against
it, and where those events come from.

Nothing here runs an action, the user-intent operation a gesture is bound to.
This package answers one question, "does this input match this description?",
and leaves what happens next to the caller.

## The parts of a route

A route is made of these slots, in this order:

| Slot | Example | Required | Meaning |
|---|---|---|---|
| Phase | `[initial]` | yes | The state the owning tool must be in. |
| Gesture | `click` | yes | The form of input. |
| Argument | `(up)` | no | Narrows the gesture: a wheel direction, a key, a finger count, a MIME type. |
| Target | `=> empty` | no | What the pointer must be over. |
| Modifiers | `+shift ?alt` | no | Keys that must or may be held. |

Some complete routes:

| Route | Fires when |
|---|---|
| `[initial] click => empty +shift` | The user shift-clicks empty canvas while the tool is idle. |
| `[initial] drag => selected-body` | The user drags a selected object while the tool is idle. |
| `[*:*] wheel(up) +mod` | The user scrolls up holding Command or Ctrl, in any state. |
| `[*:*] keyDown(Delete)` | The user presses Delete, in any state. |
| `[engaged] keyDown(Escape)` | The user presses Escape while this tool has a gesture in flight. |
| `[*:*] drop(image/*)` | The user drops an image file on the canvas. |

### Phase

A tool is `engaged` while an action it began is still running, such as a drag
that has not been released, and `initial` otherwise. The phase slot is a
comma-separated list of atoms, and the route matches when any one of them does.

| Atom | Matches when |
|---|---|
| `initial` | The binding's own tool is idle. |
| `engaged` | The binding's own tool is mid-gesture. |
| `*` | The binding's own tool is in either state. |
| `rect:engaged` | The tool with id `rect` is mid-gesture. |
| `*:engaged` | Any tool is mid-gesture. |
| `*:initial` | No tool is mid-gesture. |
| `*:*` | Always. |

An atom with no tool id before the colon refers to the tool that owns the
binding. A binding that belongs to no tool has no "own tool", so `[initial]`,
`[engaged]`, and `[*]` never match for it. Write `[*:*]` for a route that
should not depend on phase at all.

### Gesture, argument, and target

| Gesture | Input | Argument | Takes a target |
|---|---|---|---|
| `click` | Press and release without moving past the drag threshold | none | yes |
| `dblTap` | Two clicks close together in time and place | none | yes |
| `drag` | Press, then movement past the drag threshold | none | yes |
| `pointerDown` | The press itself, before it is known to be a click or a drag | none | yes |
| `hover` | Pointer movement with no button held | none | yes |
| `contextMenu` | Right-click | none | yes |
| `longPress` | A touch or pen held still | none | yes |
| `wheel` | Scroll wheel or trackpad scroll | `up`, `down`, or `*` | yes |
| `pinch` | A pinch reported as a scale factor | `in`, `out`, or `*` | yes |
| `keyDown` | A keystroke | a key name | no |
| `keyHeld` | A key going down, to be held | a key name | no |
| `keyUp` | A key release | a key name | no |
| `multiTouch` | Several fingers down and moving | `2`, `3`, or `4` | no |
| `multiTouchTap` | Several fingers down and up in place | `2`, `3`, or `4` | no |
| `drop` | External content dropped on the canvas | MIME globs | no |
| `paste` | External content pasted | MIME globs | no |

An omitted argument means any value, written `*`. Whitespace inside the
parentheses is part of the value. For `drop` and `paste`, separate several MIME
globs with `|`, as in `drop(image/*|text/plain)`.

An omitted target also means anything. The targets a route can name are:

| Target | The pointer is over |
|---|---|
| `empty` | Empty canvas. |
| `selected-body` | An object that is in the selection. |
| `unselected-body` | An object that is not. |
| `kind:<name>` | An object of that kind, such as `kind:text`. |
| `kind:<name>:selected` | An object of that kind that is also selected. |
| `affordance:<name>` | A specific piece of interactive chrome, such as a resize handle, matched by its exact name. |

### Modifiers

`+shift` requires the key and `?shift` allows it either way. The names are
`mod`, `shift`, `alt`, `ctrl`, and `meta`. A modifier the route does not
mention must not be held, so `[*:*] click` does not match a shift-click.

`mod` means Command on Apple platforms and Ctrl elsewhere. Do not combine it
with `ctrl` or `meta` in one route.

A key gesture can also mark a modifier optional inside its argument:
`keyDown(z?shift) +mod` matches Command-Z with or without Shift.

## Parse and format a route

[parseRoute](#pkg/gestures/reference/parseRoute) returns the slots as a
`ParsedRoute` with the shorthand filled in:

```ts
import { formatRoute, parseRoute } from '@weasel-js/gestures';

const route = parseRoute('[initial] click => empty +shift');
// {
//   phases: [{ channel: '&', phase: 'initial' }],   '&' is the binding's own tool
//   gesture: 'click',
//   arg: undefined,
//   target: 'empty',
//   modifiers: { shift: 'required' },
// }

formatRoute(route);                          // '[initial] click => empty +shift'
formatRoute(parseRoute('[&:engaged] wheel')); // '[engaged] wheel'
```

`parseRoute` throws an `Error` naming the input when the string is not a valid
route: missing phase brackets, an unknown gesture or modifier, an argument
value the gesture does not allow, or a target on a gesture that takes none.

`formatRoute` writes the canonical form: shorthand phases, wildcard arguments
and targets left out, and modifiers in a fixed order. Parsing its output gives
back the same `ParsedRoute`, so it is safe for storing and comparing routes.

`describeRoute` renders a parsed route as a sentence for a shortcut list or a
tooltip:

```ts
import { describeRoute, parseRoute } from '@weasel-js/gestures';

describeRoute(parseRoute('[initial] keyHeld(Space)'));
// 'Fires when the user holds Space, while the tool is idle.'
```

## Turn a route into a spec

The matcher does not take a `ParsedRoute`. It takes a `GestureSpec`, an object
with a `kind` and optional `target`, `mods`, and `phase` fields.
[routeToSpec](#pkg/gestures/reference/routeToSpec) converts one to the other:

```ts
import { parseRoute, routeToSpec } from '@weasel-js/gestures';

const spec = (route: string) => routeToSpec(parseRoute(route));

spec('[*:*] click => empty');
// { kind: 'click', target: 'empty' }

spec('[*:*] drag +mod +alt ?shift');
// { kind: 'drag', mods: { mod: true, alt: true, shift: 'optional' } }

spec('[*:*] keyDown(z?shift) +mod');
// { kind: 'key', key: 'z', mods: { mod: true, shift: 'optional' } }

spec('[initial] wheel(up)');
// { kind: 'wheel', direction: 'up', phase: [{ channel: '&', phase: 'initial' }] }
```

Wildcards become omitted fields, so an unconstrained route produces the
smallest spec. Most gesture names are also the spec kind. The exceptions:
`dblTap` becomes `'doubleClick'`, `keyDown` becomes `'key'`, and `keyHeld`
becomes `'key-held'`.

`routeToSpec` throws for a route no spec can express: any `keyUp` route, a key
or finger-count gesture with no concrete argument, or a target that is not one
of the forms in the table above.

You can also write a spec by hand. That is the only way to use a target the
string forms cannot express, a predicate over whatever is under the pointer:

```ts
import { bodyPredicate, type GestureSpec } from '@weasel-js/gestures';

const dragAnyBody: GestureSpec = {
  kind: 'drag',
  target: { kindOf: bodyPredicate((body) => body !== undefined && body !== 'empty') },
};
```

## Match an event

An `InputEvent` is one normalized input. Its `kind` says what happened, and it
always carries the modifier flags `altKey`, `ctrlKey`, `metaKey`, and
`shiftKey`.
[matchSpec](#pkg/gestures/reference/matchSpec) takes an event, a spec, and
whether `mod` should mean Command:

```ts
import {
  isApplePlatform, matchSpec, parseRoute, routeToSpec, type InputEvent,
} from '@weasel-js/gestures';

const zoomIn = routeToSpec(parseRoute('[*:*] wheel(up) +mod'));

const scroll: InputEvent = {
  kind: 'wheel', deltaX: 0, deltaY: -120, clientX: 0, clientY: 0,
  altKey: false, ctrlKey: false, metaKey: true, shiftKey: false,
};

matchSpec(scroll, zoomIn, true);   // true: on a Mac, mod is the Command key
matchSpec(scroll, zoomIn, false);  // false: elsewhere mod is Ctrl, and Command is not allowed

matchSpec(scroll, zoomIn, isApplePlatform()); // what a host passes
```

Each spec kind matches one event kind:

| Spec `kind` | Event `kind` |
|---|---|
| `'key'` | `'key'` |
| `'key-held'` | `'key-held'` with `phase: 'down'` |
| `'click'` | `'click'` |
| `'doubleClick'` | `'doubleclick'` |
| `'drag'` | `'pointerdown'` without a `stage` |
| `'pointerDown'` | `'pointerdown'` with `stage: 'press'` |
| `'hover'`, `'contextMenu'`, `'longPress'` | `'hover'`, `'contextmenu'`, `'longpress'` |
| `'wheel'`, `'pinch'` | `'wheel'`, `'pinch'` |
| `'multiTouch'`, `'multiTouchTap'` | `'multitouch'`, `'multitouchtap'` |
| `'drop'`, `'paste'` | `'drop'`, `'paste'` |

A drag is matched on its press, not on its moves. The `'pointermove'`,
`'pointerup'`, and `'pointercancel'` events match no spec. They exist so the
caller can drive a drag that has already started.

### Targets need a classified event

The matcher does no hit-testing. A target is checked against fields the caller
put on the event:

| Event field | Read by |
|---|---|
| `bodyTarget`: `'empty'`, `'selected-body'`, or `'unselected-body'` | The `empty`, `selected-body`, and `unselected-body` targets, and `kind:<name>:selected`. |
| `bodyKind`: a string | The `kind:<name>` targets. |
| `affordance`: an object with a string `kind` | The `affordance:<name>` targets. |

If the field a target reads is missing, the spec does not match. A missing
field is never treated as a wildcard.

```ts
import { matchSpec, parseRoute, routeToSpec, type InputEvent } from '@weasel-js/gestures';

const clickText = routeToSpec(parseRoute('[*:*] click => kind:text'));
const mods = { altKey: false, ctrlKey: false, metaKey: false, shiftKey: false };

const onText: InputEvent = { kind: 'click', bodyTarget: 'unselected-body', bodyKind: 'text', ...mods };
const unclassified: InputEvent = { kind: 'click', ...mods };

matchSpec(onText, clickText, false);        // true
matchSpec(unclassified, clickText, false);  // false
```

### Phases need a context

A spec with a `phase` is checked against a `PhaseContext`, the fourth argument:
which tool owns the binding, and which tools are engaged right now.

```ts
import { matchSpec, parseRoute, routeToSpec, type InputEvent } from '@weasel-js/gestures';

const cancel = routeToSpec(parseRoute('[engaged] keyDown(Escape)'));
const escape: InputEvent = {
  kind: 'key', key: 'Escape',
  altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
};

const drawing = { selfChannel: 'rect', engagedChannels: new Set(['rect']) };
const idle = { selfChannel: 'rect', engagedChannels: new Set<string>() };

matchSpec(escape, cancel, false, drawing); // true
matchSpec(escape, cancel, false, idle);    // false
matchSpec(escape, cancel, false);          // false: no context means no owning tool
```

## Pick between several matches

More than one spec can match an event: a plain `click` and a
`click => empty` both match a click on empty canvas.
[specificity](#pkg/gestures/reference/specificity) scores a spec so the
narrower one can win. It returns a tuple compared left to right, higher first:

| Position | Scores |
|---|---|
| First | How much the target narrows: 3 for `kind:<name>:selected`, 2 for `kind:<name>` or `affordance:<name>`, 1 for a body target or a predicate, 0 for none. |
| Second | How many modifiers are required. Optional ones do not count. |
| Third | How much the phase narrows: 2 when both tool and state are named, 1 when one is a wildcard, 0 for `*:*` or no phase. |
| Fourth | 2 for a `drop` or `paste` spec with a MIME filter, otherwise 1. |

```ts
import { parseRoute, routeToSpec, specificity, type GestureSpec } from '@weasel-js/gestures';

const spec = (route: string) => routeToSpec(parseRoute(route));

specificity(spec('[*:*] click'));                             // [0, 0, 0, 1]
specificity(spec('[*:*] click => empty'));                    // [1, 0, 0, 1]
specificity(spec('[*:*] click => kind:rect:selected +shift')); // [3, 1, 0, 1]
specificity(spec('[initial] click'));                         // [0, 0, 2, 1]

/** Sort comparator: most specific first. */
function bySpecificity(a: GestureSpec, b: GestureSpec): number {
  const sa = specificity(a);
  const sb = specificity(b);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return sb[i]! - sa[i]!;
  }
  return 0;
}
```

`Array.prototype.sort` is stable, so specs that tie keep the order they were
registered in.

## Where the events come from

Key, wheel, and drop events are each built from one DOM event. Pointer
gestures are not: a click, a drag, a double click, and a long-press are all
decided by what happens after the press.
[createPointerRecognizer](#pkg/gestures/reference/createPointerRecognizer)
makes those decisions. You feed it every pointer press, move, release, and
cancel, and it calls your `sink.dispatch` with each `InputEvent` it recognizes.

```ts
import {
  createPointerRecognizer, isApplePlatform, matchSpec, parseRoute, routeToSpec,
  type GestureSpec, type InputEvent, type PointerSample,
} from '@weasel-js/gestures';

const isMac = isApplePlatform();

const bindings: { spec: GestureSpec; run: (event: InputEvent) => void }[] = [
  { spec: routeToSpec(parseRoute('[*:*] click => empty')), run: () => console.log('clicked empty canvas') },
  { spec: routeToSpec(parseRoute('[*:*] drag')), run: () => console.log('drag started') },
];

const recognizer = createPointerRecognizer({
  clock: {
    now: () => performance.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (timer) => clearTimeout(timer as number),
  },
  sink: {
    dispatch(event) {
      const hit = bindings.find((b) => matchSpec(event, b.spec, isMac));
      if (!hit) return 'unhandled';
      hit.run(event);
      return 'handled';
    },
    multiTouchInFlight: () => false,
  },
});

const sampleOf = (e: PointerEvent): PointerSample => ({
  pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY, target: e.target,
  altKey: e.altKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey,
});

function listen(surface: HTMLElement): void {
  surface.addEventListener('pointerdown', (e) => {
    recognizer.press({
      ...sampleOf(e),
      pointerType: e.pointerType,
      // What the host found under the pointer. A real host hit-tests its scene here.
      x: e.clientX, y: e.clientY, bodyTarget: 'empty',
    });
  });
  surface.addEventListener('pointermove', (e) => { recognizer.move(sampleOf(e)); });
  surface.addEventListener('pointerup', (e) => { recognizer.release(sampleOf(e)); });
  surface.addEventListener('pointercancel', (e) => { recognizer.cancel(e.pointerId); });
}
```

A press sample carries more than a move does: `x` and `y` are the world point
the host hit-tested at, and `bodyTarget`, `bodyKind`, and `affordance` are what
it found there. The recognizer copies them onto the events that press turns
into, which is how a click event comes to have a `bodyTarget` for the matcher
to read.

What reaches the sink, in order:

| The user | Events dispatched |
|---|---|
| Presses and releases in place | `pointerdown` with `stage: 'press'`, `pointerup`, `click` |
| Does that twice, quickly and close together | The same, then `pointerup`, `click`, `doubleclick` on the second release |
| Presses and drags | `pointerdown` with `stage: 'press'`, then, once the pointer has moved `DRAG_THRESHOLD_PX`, a second `pointerdown` without a stage, then a `pointermove` for that move and each one after, then `pointerup` |
| Holds a touch or pen still for `LONG_PRESS_MS` | `pointerdown` with `stage: 'press'`, then `longpress` |
| Puts a second finger down | `multitouch` with the finger count, and the centroid, spread, and angle of the fingers |

Moves before the threshold also dispatch `pointermove`. A release after a drag
dispatches no `click`.

The value `dispatch` returns matters for a long-press. If it answers
`'unhandled'`, the recognizer dispatches a `contextmenu` event at the same
point, so a context-menu binding works under a finger. If that is unhandled
too, the press is left alone and can still become a click or a drag.

`multiTouchInFlight(fingers)` tells the recognizer whether the host is running
a multitouch gesture with that many fingers. While it answers `true`, each
pointer move dispatches a `multitouch` event with updated geometry ahead of
the `pointermove`.

The clock is an option so that a test can supply one that only advances when
told to, and check a long-press or a double click without waiting.
