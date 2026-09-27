"""Tiny SVG authoring helpers: wrapped rich text (backticks = code), boxes, arrows."""
import re
from xml.sax.saxutils import escape

SANS = "-apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, Arial, sans-serif"
MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

# role -> (fill, stroke)
PAL = {
    'bg': '#FBFAF6',
    'ink': '#1F2328',
    'muted': '#59636E',
    'line': '#8C959F',
    'blue': ('#E4EEFA', '#2F6FB3'),
    'green': ('#E3F2E6', '#2E7D4F'),
    'amber': ('#FCF0DA', '#B26B00'),
    'purple': ('#EEE6F8', '#6E47A8'),
    'red': ('#FAE3E0', '#B4382F'),
    'gray': ('#EEEFF1', '#6E7781'),
    'white': ('#FFFFFF', '#8C959F'),
}
CODE_INK = '#8A3B12'

SANS_EM = 0.545
MONO_EM = 0.61


def tokens(text):
    """Split into (word, is_code) tokens; backtick spans are code and keep spaces."""
    out = []
    for i, part in enumerate(re.split(r'`', text)):
        if part == '':
            continue
        if i % 2 == 1:
            out.append((part, True))
        else:
            for w in re.findall(r'\S+|\s+', part):
                out.append((w, False))
    return out


def tw(tok, size):
    word, code = tok
    return len(word) * size * (MONO_EM if code else SANS_EM)


def units(text):
    """Group tokens into unbreakable units: runs with no whitespace between them."""
    out, cur = [], []
    for tok in tokens(text):
        if tok[0].isspace() and not tok[1]:
            if cur:
                out.append(cur)
                cur = []
            out.append(None)
        else:
            cur.append(tok)
    if cur:
        out.append(cur)
    return out


def wrap(text, width, size):
    """Wrap rich text into lines of tokens."""
    lines, cur, cw = [], [], 0.0
    for unit in units(text):
        if unit is None:
            if cur:
                cur.append((' ', False))
                cw += tw((' ', False), size)
            continue
        w = sum(tw(t, size) for t in unit)
        if cur and cw + w > width:
            while cur and cur[-1][0] == ' ' and not cur[-1][1]:
                cur.pop()
            lines.append(cur)
            cur, cw = [], 0.0
        cur.extend(unit)
        cw += w
    while cur and cur[-1][0] == ' ' and not cur[-1][1]:
        cur.pop()
    if cur:
        lines.append(cur)
    return lines


def line_svg(toks, x, y, size, fill=None, weight=None, anchor='start'):
    fill = fill or PAL['ink']
    attrs = f'x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}"'
    if weight:
        attrs += f' font-weight="{weight}"'
    if anchor != 'start':
        attrs += f' text-anchor="{anchor}"'
    spans = []
    for word, code in toks:
        if code:
            spans.append(f'<tspan font-family="{MONO}" fill="{CODE_INK}">{escape(word)}</tspan>')
        else:
            spans.append(escape(word))
    return f'<text {attrs} font-family="{SANS}" xml:space="preserve">{"".join(spans)}</text>'


class Doc:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.parts = []
        self._markers = set()

    def add(self, s):
        self.parts.append(s)

    def text(self, text, x, y, size=13, fill=None, weight=None, anchor='start', width=None):
        """Rich text, wrapped when width is given. Returns y after the last line."""
        lh = size * 1.38
        lines = wrap(text, width, size) if width else [tokens(text)]
        for i, toks in enumerate(lines):
            self.add(line_svg(toks, x, y + i * lh, size, fill, weight, anchor))
        return y + (len(lines) - 1) * lh

    def rect(self, x, y, w, h, role='white', rx=8, dash=None, sw=1.5, fill=None, stroke=None):
        f, s = PAL[role]
        f = fill or f
        s = stroke or s
        d = f' stroke-dasharray="{dash}"' if dash else ''
        self.add(f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" '
                 f'fill="{f}" stroke="{s}" stroke-width="{sw}"{d}/>')

    def arrow(self, pts, color=None, sw=1.6, dash=None, head=True, marker='ah'):
        color = color or PAL['line']
        d = 'M' + ' L'.join(f'{x:.1f},{y:.1f}' for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ''
        mk = f' marker-end="url(#{marker}-{color[1:]})"' if head else ''
        self._markers.add(color)
        self.add(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{sw}"{da}{mk} '
                 f'stroke-linejoin="round"/>')

    _markers = set()

    def render(self, title, desc):
        defs = ''.join(
            f'<marker id="ah-{c[1:]}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" '
            f'markerHeight="7" markerUnits="userSpaceOnUse" orient="auto-start-reverse">'
            f'<path d="M0,0 L10,5 L0,10 z" fill="{c}"/></marker>'
            for c in sorted(self._markers))
        # markerWidth in user units: scale arrowheads to 9px
        defs = defs.replace('markerWidth="7" markerHeight="7"', 'markerWidth="9" markerHeight="9"')
        return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" '
                f'viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="t d">\n'
                f'<title id="t">{escape(title)}</title>\n<desc id="d">{escape(desc)}</desc>\n'
                f'<defs>{defs}</defs>\n'
                f'<rect x="0" y="0" width="{self.w}" height="{self.h}" fill="{PAL["bg"]}"/>\n'
                + '\n'.join(self.parts) + '\n</svg>\n')


class Card:
    """A box with a bold title and wrapped body paragraphs; measure first, then draw."""
    PAD = 14

    def __init__(self, title, paras, width, role='white', size=13, title_size=14.5, gap=6):
        self.title, self.paras, self.w, self.role = title, paras, width, role
        self.size, self.ts, self.gap = size, title_size, gap
        inner = width - 2 * self.PAD
        self.layout = []  # (indent, lines)
        for p in paras:
            if p.startswith('• '):
                self.layout.append((14, wrap(p[2:], inner - 14, size), True))
            elif p.startswith('▸ '):
                # example line: indented, with a rule down its left edge
                self.layout.append((12, wrap(p[2:], inner - 12, size), 'ex'))
            else:
                self.layout.append((0, wrap(p, inner, size), False))
        lh = size * 1.38
        h = self.PAD + (self.ts * 1.2 if title else 0)
        for i, (_, lines, _) in enumerate(self.layout):
            h += (gap if (i > 0 or title) else 0) + len(lines) * lh
        self.h = h + self.PAD - 4

    def draw(self, doc, x, y, **rect_kw):
        self.x, self.y = x, y
        doc.rect(x, y, self.w, self.h, self.role, **rect_kw)
        lh = self.size * 1.38
        cy = y + self.PAD + self.ts * 0.85
        if self.title:
            doc.add(line_svg(tokens(self.title), x + self.PAD, cy, self.ts, weight='700'))
            cy += self.ts * 0.35 + self.gap + self.size * 1.0
        else:
            cy = y + self.PAD + self.size * 0.95
        first = True
        for indent, lines, bullet in self.layout:
            if not first:
                cy += self.gap
            first = False
            if bullet == 'ex':
                doc.add(f'<rect x="{x + self.PAD:.1f}" y="{cy - self.size * 0.95:.1f}" width="3" '
                        f'height="{len(lines) * lh - self.size * 0.2:.1f}" rx="1.5" fill="{PAL[self.role][1]}" '
                        f'fill-opacity="0.55"/>')
            elif bullet:
                doc.add(f'<circle cx="{x + self.PAD + 4:.1f}" cy="{cy - self.size * 0.33:.1f}" r="2.2" '
                        f'fill="{PAL["muted"]}"/>')
            for toks in lines:
                doc.add(line_svg(toks, x + self.PAD + indent, cy, self.size))
                cy += lh
            cy -= lh
            cy += lh
        return self

    # edge anchors
    @property
    def top(self):
        return (self.x + self.w / 2, self.y)

    @property
    def bottom(self):
        return (self.x + self.w / 2, self.y + self.h)

    def left(self, dy=None):
        return (self.x, self.y + (self.h / 2 if dy is None else dy))

    def right(self, dy=None):
        return (self.x + self.w, self.y + (self.h / 2 if dy is None else dy))
