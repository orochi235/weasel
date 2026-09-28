"""Draws docs/diagrams/precedence-fallthrough.svg. Regenerate: python3 docs/diagrams/src/precedence-fallthrough.py docs/diagrams/precedence-fallthrough.svg"""
import sys
from svglib import Doc, Card, PAL, line_svg, tokens, wrap

W = 1620
LX, LW = 40, 680
RX, RW = 780, 800
GAP = 16

doc = Doc(W, 100)
doc.text('Which binding wins', 40, 44, size=22, weight='700')
doc.text('The order `handleInput` leaves its candidates in, best first, and where the two filters and the '
         '`enabled()` walk sit relative to it. Example routes are in the route grammar: '
         '`[phase] gesture(arg) => target +mods`.', 40, 70, size=13.5, fill=PAL['muted'], width=W - 80)

items = [
    ('in', Card('Every binding whose spec matches the input', [
        'Kind, key, modifiers, target and phase all match (`matchSpec`).',
        '▸ Escape with no drag in flight matches `[*:initial] keyDown(Escape)` and `[*:*] keyDown(Escape)`, '
        'not `[*:engaged] keyDown(Escape)`.',
        '▸ Shift+Up matches `[*:*] keyDown(ArrowUp) +shift` and not `[*:*] keyDown(ArrowUp)`: a modifier the route '
        'does not name must not be held.',
    ], LW, 'gray'), None),
    ('claim', Card('Filter: exclusive affordance claim', [
        'When the pressed affordance claims this gesture exclusively, only bindings whose target consults the affordance stay (`affordance:<kind>` or a `kindOf` predicate).',
        '▸ A drag from a diagram port keeps `[*:*] drag => affordance:layer:diagram-ports` and drops '
        '`[*:*] drag => unselected-body` and `[*:*] drag`.',
    ], LW - 40, 'red'), 'filter'),
    ('r1', Card('Names the routed view', [
        'A binding whose `views` includes this view goes ahead of every binding that does not, across all tiers (`preferViewScoped`).',
        '▸ In the minimap, `minimap.pan` on `[*:*] drag` beats the space-held hand tool\'s `[*:*] drag`. '
        'The routes are identical: the grammar has no notation for `views`, so the difference lives in the '
        'binding\'s `opts.views`.',
    ], LW - 40, 'amber'), '1'),
    ('r2', Card('Scope tier', [
        'Hotkey-held tool, then the active tool, then ambient bindings.',
        '▸ With space held, the hand tool\'s `[*:*] drag` beats the select tool\'s `[*:*] drag => predicate`: '
        'the tier is compared before specificity. The grammar does not show the tier.',
    ], LW - 40, 'amber'), '2'),
    ('r3', Card('Specificity, four parts compared in order', [
        '• target: 3 for a kind that must be selected, 2 for one kind or affordance, 1 for a body class or predicate, 0 for none',
        '• required modifiers: how many',
        '• phase: 2 when channel and phase are both named, 1 when one is a wildcard, 0 for none',
        '• drop or paste with a MIME filter: 2, anything else 1',
        '▸ target: `[*:*] drag => unselected-body` (`move`) beats `[*:*] drag` (`viewport.dragPan`).',
        '▸ modifiers: `[*:*] drag +shift` beats `[*:*] drag ?shift` (`lassoSelect`); an optional modifier counts for nothing.',
        '▸ phase: `[*:engaged] keyDown(Escape)` (`cancelGesture`) beats `[*:*] keyDown(Escape)` (`tool.resetToDefault`).',
        '▸ MIME: `[*:*] drop(text/csv)` beats `[*:*] drop ?shift ?alt ?ctrl ?meta` (`ingest`).',
    ], LW - 40, 'amber'), '3'),
    ('r4', Card('Context-gated before ungated', [
        'Within a run tied on tier and specificity, an action whose `eligible` rule holds now goes ahead of one with no rule (`preferContextual`).',
        '▸ In path edit, `exitPathEdit` on `[*:*] keyDown(Escape)` beats `tool.resetToDefault` on the same route. '
        'Only the `eligible` rule tells them apart, and the grammar has no notation for it.',
    ], LW - 40, 'amber'), '4'),
    ('r5', Card('Registration order', [
        'Whatever is still tied keeps the order it was registered in; the sorts are stable.',
        '▸ `areaSelect` on `[*:*] drag` beats `lassoSelect` on `[*:*] drag ?shift`: same specificity, same '
        '`creates-selection` rule, and `areaSelect` is registered first.',
    ], LW - 40, 'amber'), '5'),
    ('elig', Card('Filter: drop ineligible', [
        'An action whose `eligible` rule is false in this mode leaves the list (`filterEligible`). Filtering does not reorder, so it can sit anywhere here.',
        '▸ In a mode without `edits-anchors`, `deleteAnchors` on `[*:initial] keyDown(Delete)` leaves; `delete` on the '
        'same route stays while `edits-page` holds.',
    ], LW - 40, 'red'), 'filter'),
    ('walk', Card('Walk the list; the first action that runs wins', [
        'Each action is tried once. `enabled()` returning anything but `true`, or an ongoing `start()` returning an empty handle, passes the turn to the next candidate. Nothing left: unhandled.',
        '▸ With nothing selected, `escape` on `[*:initial] keyDown(Escape)` declines and '
        '`tool.resetToDefault` on `[*:*] keyDown(Escape)` fires.',
    ], LW, 'purple'), None),
]

y = 128
cards = {}
for key, c, badge in items:
    x = LX if badge is None else LX + 40
    c.draw(doc, x, y)
    cards[key] = c
    if badge:
        cy = y + c.h / 2
        if badge == 'filter':
            # funnel glyph
            doc.add(f'<path d="M{LX + 4},{cy - 11} L{LX + 30},{cy - 11} L{LX + 21},{cy + 1} L{LX + 21},{cy + 11} '
                    f'L{LX + 13},{cy + 7} L{LX + 13},{cy + 1} Z" fill="{PAL["red"][0]}" stroke="{PAL["red"][1]}" '
                    f'stroke-width="1.5" stroke-linejoin="round"/>')
        else:
            doc.add(f'<circle cx="{LX + 17}" cy="{cy:.1f}" r="13" fill="{PAL["amber"][1]}"/>')
            doc.add(line_svg(tokens(badge), LX + 17, cy + 5, 14, fill='#FFFFFF', weight='700', anchor='middle'))
    y += c.h + GAP
H_left = y

# ladder rails + arrows between cards (rails along the rung column)
keys = [k for k, _, _ in items]
for a, b in zip(keys, keys[1:]):
    ca, cb = cards[a], cards[b]
    x = LX + 40 + (LW - 40) / 2
    doc.arrow([(x, ca.y + ca.h), (x, cb.y)], color=PAL['ink'])

# bracket for the ranking steps
top, bot = cards['r1'].y, cards['r5'].y + cards['r5'].h
bx = LX + LW + 10
doc.add(f'<path d="M{bx},{top} L{bx + 8},{top} L{bx + 8},{bot} L{bx},{bot}" fill="none" '
        f'stroke="{PAL["amber"][1]}" stroke-width="1.5"/>')
doc.add(f'<text x="{bx + 20}" y="{(top + bot) / 2:.1f}" font-size="12.5" fill="{PAL["amber"][1]}" '
        f'font-weight="700" font-family="-apple-system, \'Helvetica Neue\', Helvetica, Arial, sans-serif" '
        f'transform="rotate(90 {bx + 20} {(top + bot) / 2:.1f})" text-anchor="middle">RANKING, HIGHEST FIRST</text>')


# ---- worked examples -------------------------------------------------------
def example(y, title, setup, rows, notes):
    """rows: (rank, action, tier, spec, placed, rule, verdict, verdict_role)"""
    x0 = RX
    doc.text(title, x0, y + 18, size=16, weight='700')
    y2 = doc.text(setup, x0, y + 40, size=13, fill=PAL['muted'], width=RW)
    ty = y2 + 18
    cols = [(0, '#'), (28, 'Action and route'), (248, 'Tier'), (310, 'Specificity'), (394, 'Placed by'),
            (486, 'Rule'), (636, 'Result')]
    doc.rect(x0, ty, RW, 28, 'gray', rx=6, sw=1)
    for cx, lab in cols:
        doc.add(line_svg(tokens(lab), x0 + 10 + cx, ty + 19, 12, fill=PAL['muted'], weight='700'))
    ry = ty + 34
    for rank, action, tier, spec, placed, rule, verdict, role in rows:
        cells = [(0, rank, 28), (28, action, 220), (248, tier, 62), (310, spec, 84), (394, placed, 92),
                 (486, rule, 150), (636, verdict, 154)]
        wrapped = [(cx, wrap(t, w - 8, 12.5)) for cx, t, w in cells]
        nlines = max(len(l) for _, l in wrapped)
        rh = 12 + nlines * 17.5
        doc.rect(x0, ry, RW, rh, role, rx=6, sw=1.2)
        for cx, lines in wrapped:
            for i, toks in enumerate(lines):
                doc.add(line_svg(toks, x0 + 10 + cx, ry + 21 + i * 17.5, 12.5))
        ry += rh + 6
    ny = ry + 4
    ny = doc.text('Specificity is the step 3 score: target, modifiers, phase, typed. Placed by names the step on the left that ranks the row where it is.', x0, ny + 12, size=12, fill=PAL['muted'], width=RW) + 22
    for n in notes:
        ny = doc.text(n, x0, ny + 6, size=13, width=RW) + 22
    return ny


ey = 128
ey = example(ey, 'Escape while editing a path',
             'Mode `path-edit`, a path is being edited, nothing in flight. All four actions are ambient and bound to Escape.',
             [
                 ('—', '`cancelGesture` `[*:engaged] keyDown(Escape)`', 'ambient', '', 'the match, phase', '', 'not a candidate', 'gray'),
                 ('1', '`escape` `[*:initial] keyDown(Escape)`', 'ambient', '0 0 1 1', 'step 3, phase part', 'none', '`enabled()` declines while a path is edited', 'white'),
                 ('2', '`exitPathEdit` `[*:*] keyDown(Escape)`', 'ambient', '0 0 0 1', 'step 4', '`mode: path-edit` holds', 'fires', 'green'),
                 ('3', '`tool.resetToDefault` `[*:*] keyDown(Escape)`', 'ambient', '0 0 0 1', 'step 4', 'none', 'not asked', 'white'),
             ],
             [
                 '`escape` leads on specificity (step 3, its phase part) and declines. `exitPathEdit` and `tool.resetToDefault` tie through step 3; step 4 puts the one whose rule holds first. Outside path edit, `exitPathEdit` is dropped as ineligible instead.',
             ])

ey = example(ey + 16, 'Bare drag on empty canvas, select tool active',
             'Default mode, which allows `creates-selection`. Other ambient drag actions (`lassoSelect`, `insert`) are left out.',
             [
                 ('1', '`areaSelect` from the select tool, `[*:*] drag => predicate` (empty canvas)', 'active', '1 0 0 1', 'step 2, tier', '`creates-selection` holds', 'fires', 'green'),
                 ('2', '`areaSelect` default `[*:*] drag`', 'ambient', '0 0 0 1', 'step 4', '`creates-selection` holds', 'skipped: action already tried', 'white'),
                 ('3', '`viewport.dragPan` `[*:*] drag`', 'ambient', '0 0 0 1', 'step 4', 'none', 'not asked', 'white'),
             ],
             [
                 'The tier settles this one: the select tool\'s binding sits in the active tier. Step 4 only orders the ambient pair below it, which is what decides when no tool binds the drag.',
                 'In a mode without `creates-selection`, both `areaSelect` rows are dropped as ineligible and `viewport.dragPan` fires.',
             ])

note = Card('What a route cannot show', [
    '• A binding\'s `views`, its action\'s `eligible` rule, its tier and its registration order have no notation, so steps 1, 2, 4 and 5 and the eligibility filter compare routes that can read the same.',
    '• A `kindOf` predicate target prints as `predicate`, whatever the function tests.',
], RW, 'white')
note.draw(doc, RX, ey + 16)
ey = note.y + note.h

doc.h = max(H_left, ey) + 10
open(sys.argv[1], 'w').write(doc.render(
    'Gesture dispatch precedence',
    'The ranking steps the dispatcher sorts matching bindings by, the two filters, the enabled() '
    'fall-through walk, and two worked examples: Escape in path edit, and a bare drag with the select tool.'))
