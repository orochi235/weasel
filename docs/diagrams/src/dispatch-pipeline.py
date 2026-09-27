"""Draws docs/diagrams/dispatch-pipeline.svg. Regenerate: python3 docs/diagrams/src/dispatch-pipeline.py docs/diagrams/dispatch-pipeline.svg"""
import sys
from svglib import Doc, Card, PAL

W = 1280
SX, SW = 40, 300          # scope column
PX, PW = 390, 540         # pipeline column
OX, OW = 1020, 230         # outcome column
GAP = 30

steps = [
    ('dom', Card('1  A DOM event reaches the canvas', [
        'Pointer, wheel, pinch and context-menu listeners sit on the canvas element; key and paste listeners on `window`.',
        '• A pointerdown or wheel first calls `activate()`, making this canvas the active scope.',
        '• A keydown is dropped unless `isActive()`: only the active scope acts on keys.',
        '• A press dispatches at once with `stage: \'press\'`. Its drag copy waits until the pointer passes the drag threshold; a release before that becomes a click.',
    ], PW, 'blue')),
    ('view', Card('2  Route it to a view', [
        'With `views` set, the resolver picks the view under the pointer, and a pointerdown pins that pointer to its view until release. Keys and paste go to the view the last pointer event landed in.',
        'The view brings its own dispatcher, hit tests (`affordanceAt`, `classifyTarget`), `clientToWorld`, dep overlay and rule context. Without `views`, everything is the root view.',
    ], PW, 'blue')),
    ('pump', Card('3  Is a gesture already open on this channel?', [
        'A pointermove, pointerup, pointercancel or held-key release belongs to the handle open under its gesture id (`pointer-<id>`, `key-held-<key>`) and never reaches matching.',
        'Everything else (press, drag start, key, wheel, click, pinch) goes on.',
    ], PW, 'gray')),
    ('assemble', Card('4  Assemble scoped bindings', [
        '`assembleScopedBindings` tags each binding with a tier:',
        '• tools held by a hotkey: hotkey tier, newest hold first',
        '• the active tool: active tier',
        '• tools marked `always` or `claimed`: ambient tier',
        '• every registered action\'s bindings: ambient, or hotkey when `action.scope` is \'hotkey\'',
        'Left out: tools whose capability tags the current mode forbids, and bindings whose `views` do not include this view.',
    ], PW, 'amber')),
    ('match', Card('5  Match and rank', [
        '`matchSorted` keeps the bindings whose spec matches the event (kind, key, modifiers, target, phase). An exclusive affordance claim first bars bindings that do not consult the affordance. Survivors sort by tier, then specificity, then registration order.',
        '`preferViewScoped` then moves bindings that name this view to the front.',
    ], PW, 'amber')),
    ('elig', Card('6  Drop ineligible, prefer contextual', [
        'Only when a rule context is supplied.',
        '`filterEligible` drops candidates whose action\'s `eligible` rule is false right now.',
        '`preferContextual`: within a run tied on tier and specificity, an action whose rule holds moves ahead of one with no rule.',
    ], PW, 'amber')),
    ('walk', Card('7  Walk the candidates, best first', [
        'Each action is tried once, even when several bindings point at it.',
        '• no registered action for the id: warn, try the next',
        '• build the action\'s deps from its `requires`',
        '• `enabled(deps, point)` returns anything but `true`: try the next',
    ], PW, 'purple')),
    ('invoke', Card('8  Invoke', [
        '• immediate: `run(deps, params)`, then handled',
        '• ongoing: `start(ctx, opts)`. An empty handle means it declined: try the next candidate. Otherwise the handle is held in flight under its gesture id, then handled; later moves pump it through step 3.',
        '• no invoker: handled, as a deliberate no-op',
    ], PW, 'purple')),
]

y = 112
pos = {}
for key, card in steps:
    pos[key] = y
    y += card.h + GAP
H_steps = y

# scope column cards, aligned to the step they feed
scope_cards = [
    ('dom', Card('Scope activation', [
        '`activate()` moves the root\'s and yoke\'s active child to this scope. `isActive()` asks whether this scope is on that path.',
    ], SW, 'green')),
    ('assemble', Card('Active tool and hotkey stack', [
        'The scope\'s own tool, or its yoke\'s when it joined one.',
    ], SW, 'green')),
    ('assemble', Card('Actions registry `list()`', [
        'This scope\'s registrations, then its yoke\'s, then the root\'s. Innermost wins per id; a muted id is absent from that tier down. Step 7 looks actions up in the same list.',
    ], SW, 'green')),
    ('elig', Card('Rule context', [
        'The routed view\'s mode, allowed capabilities, selection. Step 4 reads its capabilities too.',
    ], SW, 'green')),
    ('walk', Card('Dep registry', [
        'The view\'s own deps first, then scope, yoke, root.',
    ], SW, 'green')),
]

doc = Doc(W, 100)  # height fixed later
doc.text('One input, from DOM event to action', 40, 44, size=22, weight='700')
doc.text('`useGestureDispatcher` (the React seam, steps 1 to 2) feeds `Dispatcher.handleInput` (pure, steps 3 to 8).',
         40, 70, size=13.5, fill=PAL['muted'])
doc.text('Read from the input scope', SX, 100, size=12.5, weight='700', fill=PAL['green'][1])
doc.text('Pipeline', PX, 100, size=12.5, weight='700', fill=PAL['muted'])
doc.text('Outcomes', OX, 100, size=12.5, weight='700', fill=PAL['muted'])

cards = {}
for key, card in steps:
    card.draw(doc, PX, pos[key])
    cards[key] = card

# vertical arrows between steps
keys = [k for k, _ in steps]
for a, b in zip(keys, keys[1:]):
    ax, ay = cards[a].bottom
    bx, by = cards[b].top
    if a == 'pump':
        continue
    doc.arrow([(ax, ay), (bx, by)], color=PAL['ink'])
# pump -> assemble labeled "no open handle"
ax, ay = cards['pump'].bottom
doc.arrow([(ax, ay), (ax, cards['assemble'].y)], color=PAL['ink'])
doc.text('no open handle', ax + 8, ay + 19, size=12, fill=PAL['muted'])

# scope cards placement: group by target, stack within target span
from collections import defaultdict
groups = defaultdict(list)
for key, c in scope_cards:
    groups[key].append(c)
for key, cs in groups.items():
    tgt = cards[key]
    total = sum(c.h for c in cs) + 12 * (len(cs) - 1)
    yy = tgt.y + (tgt.h - total) / 2
    for c in cs:
        c.draw(doc, SX, yy)
        cy = yy + c.h / 2
        doc.arrow([(SX + SW, cy), (PX, cy)], color=PAL['green'][1], dash='5 4')
        yy += c.h + 12
    assert total <= tgt.h + 40, (key, total, tgt.h)

# outcomes
pumpc = cards['pump']
pump_out = Card('Pump the open handle', [
    '`onMove`, or `onEnd` with commit or cancel. No matching happens.',
], OW, 'gray')
pump_out.draw(doc, OX, pumpc.y + (pumpc.h - pump_out.h) / 2)
doc.arrow([pumpc.right(), (OX, pumpc.y + pumpc.h / 2)], color=PAL['ink'])
doc.text('handle open', PX + PW + 8, pumpc.y + pumpc.h / 2 - 8, size=11.5, fill=PAL['muted'])

inv = cards['invoke']
handled = Card('handled', [
    'The key and wheel listeners call `preventDefault`.',
], OW, 'green')
handled.draw(doc, OX, inv.y + (inv.h - handled.h) / 2)
doc.arrow([inv.right(), (OX, inv.y + inv.h / 2)], color=PAL['ink'])

walk = cards['walk']
elig = cards['elig']
match = cards['match']
unh = Card('unhandled', [
    'Nothing matched, every candidate was ineligible or disabled, or every ongoing start declined. The browser default stands.',
], OW, 'red')
unh_y = elig.y + 10
unh.draw(doc, OX, unh_y)
ux = OX
ucy = unh_y + unh.h / 2
# arrows into unhandled from match (empty), elig (empty), walk (ran out)
spine = PX + PW + 70
for c, label in ((match, 'no match'), (elig, 'list empty'), (walk, 'ran out')):
    yy = c.y + c.h * 0.5
    doc.arrow([(PX + PW, yy), (spine, yy), (spine, ucy), (OX, ucy)], color=PAL['red'][1], head=False)
    doc.text(label, PX + PW + 8, yy - 6, size=11.5, fill=PAL['red'][1])
doc.arrow([(spine, ucy), (OX, ucy)], color=PAL['red'][1])
# loop arrow for fall-through on walk (next candidate) and from invoke (declined)
lx = PX - 18
doc.arrow([(PX, inv.y + 36), (lx, inv.y + 36), (lx, walk.y + 30), (PX, walk.y + 30)],
          color=PAL['purple'][1])
doc.text('declined', lx - 4, inv.y + 30 - 4, size=12, fill=PAL['purple'][1], anchor='end')

H = H_steps + 10
doc.h = H
open(sys.argv[1], 'w').write(doc.render(
    'Gesture dispatch pipeline',
    'How one input event travels from a DOM listener on the canvas, through view routing and '
    'binding assembly, matching, ranking and eligibility, to an invoked action or unhandled.'))
