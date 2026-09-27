"""Draws docs/diagrams/input-scopes.svg. Regenerate: python3 docs/diagrams/src/input-scopes.py docs/diagrams/input-scopes.svg"""
import sys
from svglib import Doc, Card, PAL, line_svg, tokens

W = 1280
doc = Doc(W, 100)
doc.text('Input scopes and yokes', 40, 44, size=22, weight='700')
doc.text('Each tier is three nodes (actions, deps, tool) mounted and activated together. Registrations stay where '
         'they are made; lookups walk up; reads from above walk down the active path first.',
         40, 70, size=13.5, fill=PAL['muted'], width=1200)

AMBER = PAL['amber'][1]
GREEN = PAL['green'][1]
BLUE = PAL['blue'][1]
GRAY = PAL['line']


def pill(x, y, label, role):
    f, s = PAL[role]
    w = len(label) * 12 * 0.56 + 16
    doc.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="20" rx="10" fill="{f}" stroke="{s}" stroke-width="1.2"/>')
    doc.add(line_svg(tokens(label), x + w / 2, y + 14.5, 12, fill=s, weight='600', anchor='middle'))


chrome = Card('Chrome at the root', [
    'A toolbar, palette or menu calling `trigger`, `begin`, `list` or `useActiveToolContext` on the root registries.',
], 300, 'blue').draw(doc, 40, 124)
root = Card('Root', [
    '`<ActionsProvider>`, `<DepRegistryProvider>`, `<ActiveToolContextProvider>`: app-wide actions and deps, and a tool state of its own.',
], 440, 'green').draw(doc, 420, 124)

yoke_tb = Card('Toolbar inside `<Yoke value={yoke}>`', [
    'Its reads go through the yoke to the member canvas used last; actions it registers are yoke-wide.',
], 300, 'blue').draw(doc, 40, 340)
yoke = Card('Yoke (optional)', [
    'Made by `useYoke()`. What its canvases share on purpose: the tool, the gesture in flight, history, yoke-wide actions.',
], 400, 'green').draw(doc, 420, 340)

SY = 560
scA = Card('Scope A', [
    '`<InputScope yoke={yoke}>`: canvas A\'s view, pointer and the actions it binds. Uses the yoke\'s tool.',
], 290, 'green').draw(doc, 250, SY)
scB = Card('Scope B', [
    'Same shape as A, for canvas B. The active scope: last to take a pointerdown or wheel.',
], 290, 'green').draw(doc, 590, SY, sw=3, stroke=AMBER)
scC = Card('Scope C', [
    'A canvas with no yoke: sits right under the root and keeps a tool of its own.',
], 290, 'green').draw(doc, 950, SY)

# tool-state pills
pill(root.x + root.w - 96, root.y + 10, 'owns a tool', 'amber')
pill(yoke.x + yoke.w - 96, yoke.y + 10, 'owns a tool', 'amber')
pill(scC.x + scC.w - 96, scC.y + 10, 'owns a tool', 'amber')

# ---- tree edges (parent -> child); active path in amber --------------------
def edge(parent, child, bus_y, active):
    px, py = parent.bottom
    cx, cy = child.top
    color = AMBER if active else GRAY
    sw = 3.2 if active else 1.6
    doc.arrow([(px, py), (px, bus_y), (cx, bus_y), (cx, cy)], color=color, sw=sw, head=active)


rb = root.y + root.h
edge(root, scC, rb + 40, False)
edge(root, yoke, rb + 40, True)
yb = yoke.y + yoke.h
edge(yoke, scA, yb + 36, False)
edge(yoke, scB, yb + 36, True)

# ---- lookup arrows from scope A: A -> yoke -> root (dashed green, upward) --
lx = 380
doc.arrow([(lx, scA.y), (lx, yoke.y + yoke.h - 20), (yoke.x, yoke.y + yoke.h - 20)], color=GREEN, dash='6 4', sw=2)
lx2 = yoke.x - 30
doc.arrow([(yoke.x, yoke.y + 30), (lx2 + 0, yoke.y + 30), (lx2, root.y + root.h - 22), (root.x, root.y + root.h - 22)],
          color=GREEN, dash='6 4', sw=2)
doc.text('lookup from A: A, then', lx - 10, scA.y - 58, size=12.5, fill=GREEN, weight='600', anchor='end')
doc.text('the yoke, then the root.', lx - 10, scA.y - 40, size=12.5, fill=GREEN, weight='600', anchor='end')
doc.text('Never B or C.', lx - 10, scA.y - 22, size=12.5, fill=GREEN, weight='600', anchor='end')

# ---- chrome -> root, reads descend the active path -------------------------
doc.arrow([chrome.right(), (root.x, chrome.y + chrome.h / 2)], color=BLUE, sw=2)
doc.text('answers from the active scope, then up its chain', root.x + root.w / 2 + 12, rb + 30, size=12.5,
         fill=AMBER, weight='600')

# toolbar in yoke -> yoke
doc.arrow([yoke_tb.right(), (yoke.x, yoke_tb.y + yoke_tb.h / 2)], color=BLUE, sw=2)

# ---- bottom: registration into A, activation of B, key gate on C -----------
BY = SY + max(scA.h, scB.h, scC.h) + 70
reg = Card('A component inside canvas A', [
    'calls `useAction` or `useDepSource`. The registration lands in the innermost tier around it: scope A.',
], 290, 'blue').draw(doc, scA.x, BY)
act = Card('pointerdown or wheel on canvas B', [
    '`activate()` points every ancestor\'s active child toward B; B\'s dep and tool nodes move with it.',
], 290, 'blue').draw(doc, scB.x, BY)
key = Card('keydown with canvas C', [
    'Dropped: `isActive()` is false, because C is not on the active path. Keys act only in the active scope.',
], 290, 'red').draw(doc, scC.x, BY)
for c, s in ((reg, scA), (act, scB)):
    doc.arrow([(c.x + c.w / 2, c.y), (s.x + s.w / 2, s.y + s.h)], color=BLUE, sw=2)
doc.arrow([(key.x + key.w / 2, key.y), (scC.x + scC.w / 2, scC.y + scC.h)], color=PAL['red'][1], sw=2, dash='5 4')

# ---- notes ------------------------------------------------------------------
ny = BY + max(reg.h, act.h, key.h) + 40
notes = [
    'With no active child yet, a read from above goes to the newest member; a yoke with no members is passed over.',
    '`mute(id)` hides an id from that node down while it stays registered where it was. `unregister(id)` removes it from the node it is called on.',
    'A new scope starts on the tool in effect around it. `<SceneCanvas>`, labkit\'s `<CanvasStack>` and `<Stage>` each mount a scope.',
]
for n in notes:
    doc.add(f'<circle cx="46" cy="{ny - 4.5:.1f}" r="2.4" fill="{PAL["muted"]}"/>')
    ny = doc.text(n, 58, ny, size=13, width=1180) + 24

# legend
ly = ny + 4
items = [
    (GRAY, 1.6, None, 'parent and child'),
    (AMBER, 3.2, None, 'the active path'),
    (GREEN, 2, '6 4', 'lookup, walking up'),
    (BLUE, 2, None, 'a call, registration or activation'),
]
x = 40
for color, sw, dash, label in items:
    doc.arrow([(x, ly), (x + 40, ly)], color=color, sw=sw, dash=dash, head=color != GRAY)
    doc.text(label, x + 50, ly + 4.5, size=12.5, fill=PAL['muted'])
    x += 60 + len(label) * 12.5 * 0.55 + 30

doc.h = ly + 26
open(sys.argv[1], 'w').write(doc.render(
    'Input scopes and yokes',
    'The tier tree: root registries, an optional yoke, and per-canvas input scopes. Registrations land in the '
    'innermost tier, lookups walk scope to yoke to root, and chrome at the root reads through the active scope, '
    'which a pointerdown or wheel moves.'))
