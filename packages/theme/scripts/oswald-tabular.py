"""Build Oswald Tabular: Oswald's ten digits, its plus and minus signs, each
centered in one shared advance at every weight, plus a figure space that wide,
renamed so it can sit in front of Oswald in a font stack.

    python packages/theme/scripts/oswald-tabular.py

Needs fontTools with brotli (see fonts/README.md). Reads and writes in fonts/.
"""

from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.hvar import add_HVAR

FONTS = Path(__file__).resolve().parent.parent / "fonts"
SOURCE = FONTS / "oswald-latin-variable.woff2"
OUTPUT = FONTS / "oswald-tabular-digits.woff2"
FAMILY = "Oswald Tabular"
DIGITS = "0123456789"
# U+2212, never the hyphen: a hyphen in a date or an id stays a hyphen, and
# @weasel-js/quantity writes negatives with U+2212.
SIGNS = "+\u2212"


def subset_digits(font: TTFont) -> None:
    opts = subset.Options()
    opts.layout_features = []
    opts.hinting = False
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=[ord(c) for c in DIGITS + SIGNS])
    s.subset(font)


def infer_deltas(font: TTFont, names: list[str]) -> None:
    """Spell out every point's delta, so a glyph can be moved or rebuilt point by point."""
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"].variations
    vmtx = font["vmtx"].metrics if "vmtx" in font else None
    for g in names:
        coords, ctrl = glyf._getCoordinatesAndControls(g, hmtx.metrics, vmtx)
        for t in gvar[g]:
            t.calcInferredDeltas(coords, ctrl.endPts)


def minus_from_plus(font: TTFont) -> None:
    """Rebuild the minus as the plus's crossbar. Oswald draws its minus shorter than
    the plus's arm (299 units to 365 at the default weight), so a column of signed
    figures would show two bar lengths. The arm's four corners carry their own
    deltas, so the bar matches the plus at every weight."""
    cmap = font.getBestCmap()
    plus, minus = cmap[ord("+")], cmap[0x2212]
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"].variations
    src = glyf[plus]
    xs = [x for x, _ in src.coordinates]
    lo, hi = min(xs), max(xs)
    # The arm's ends: the two points at each horizontal extreme, bottom first.
    left = sorted((i for i, (x, _) in enumerate(src.coordinates) if x == lo), key=lambda i: src.coordinates[i][1])
    right = sorted((i for i, (x, _) in enumerate(src.coordinates) if x == hi), key=lambda i: src.coordinates[i][1])
    if len(left) != 2 or len(right) != 2:
        raise SystemExit("plus no longer has a two-point arm end on each side")
    order = [left[0], left[1], right[1], right[0]]
    n = len(src.coordinates)

    from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphCoordinates

    bar = Glyph()
    bar.numberOfContours = 1
    bar.coordinates = GlyphCoordinates([src.coordinates[i] for i in order])
    bar.endPtsOfContours = [3]
    bar.flags = bytearray([1, 1, 1, 1])
    bar.program = src.program
    glyf[minus] = bar
    bar.recalcBounds(glyf)
    hmtx[minus] = hmtx[plus]
    gvar[minus] = [
        type(t)(dict(t.axes), [t.coordinates[i] for i in order] + list(t.coordinates[n:]))
        for t in gvar[plus]
    ]


def tabulate(font: TTFont) -> None:
    """Give every digit and sign the widest digit's advance, at the default weight
    and at each master, shifting each outline by half the difference so it stays centered."""
    cmap = font.getBestCmap()
    digits = [cmap[ord(c)] for c in DIGITS]
    names = digits + [cmap[ord(c)] for c in SIGNS]
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"].variations

    target = max(hmtx[g][0] for g in digits)
    # Widest digit advance at each master, as a delta from `target`.
    regions: dict[tuple, int] = {}
    for g in digits:
        for t in gvar[g]:
            key = tuple(sorted(t.axes.items()))
            n = len(t.coordinates)
            at_master = hmtx[g][0] + t.coordinates[n - 3][0] - t.coordinates[n - 4][0]
            regions[key] = max(regions.get(key, at_master), at_master)
    regions = {k: v - target for k, v in regions.items()}

    for g in names:
        glyph = glyf[g]
        adv, lsb = hmtx[g]
        dx = (target - adv) // 2
        glyph.coordinates.translate((dx, 0))
        glyph.recalcBounds(glyf)
        hmtx[g] = (target, lsb + dx)
        for t in gvar[g]:
            coords = t.coordinates
            n = len(coords)
            left, right = coords[n - 4][0], coords[n - 3][0]
            want = regions[tuple(sorted(t.axes.items()))]
            shift = round((want - (right - left)) / 2)
            t.coordinates = [
                (x + shift, y) for x, y in coords[: n - 4]
            ] + [coords[n - 4], (left + want, coords[n - 3][1])] + coords[n - 2 :]
            t.roundDeltas()

    add_figure_space(font, target, regions)


def add_figure_space(font: TTFont, target: int, regions: dict[tuple, int]) -> None:
    """U+2007, a blank one digit wide at every weight. Oswald has none, so padding
    a readout with it would otherwise take the width of whatever face supplies it."""
    from fontTools.ttLib.tables._g_l_y_f import Glyph
    from fontTools.ttLib.tables.TupleVariation import TupleVariation

    name = "uni2007"
    font.setGlyphOrder(font.getGlyphOrder() + [name])
    font["glyf"].glyphs[name] = Glyph()
    font["glyf"].glyphOrder = font.getGlyphOrder()
    font["hmtx"][name] = (target, 0)
    for table in font["cmap"].tables:
        if table.isUnicode():
            table.cmap[0x2007] = name
    font["gvar"].variations[name] = [
        TupleVariation(dict(key), [(0, 0), (delta, 0), (0, 0), (0, 0)])
        for key, delta in regions.items()
    ]
    font["maxp"].numGlyphs = len(font.getGlyphOrder())


def rename(font: TTFont) -> None:
    table = font["name"]
    ps = FAMILY.replace(" ", "")
    for rec in table.names:
        if rec.nameID in (1, 16):
            rec.string = FAMILY
        elif rec.nameID == 4:
            rec.string = str(rec).replace("Oswald", FAMILY, 1)
        elif rec.nameID == 6:
            rec.string = str(rec).replace("Oswald", ps, 1)
        elif rec.nameID == 25:
            rec.string = ps


def main() -> None:
    font = TTFont(SOURCE)
    subset_digits(font)
    cmap = font.getBestCmap()
    infer_deltas(font, [cmap[ord(c)] for c in DIGITS + SIGNS])
    minus_from_plus(font)
    tabulate(font)
    if "HVAR" in font:
        del font["HVAR"]
        add_HVAR(font)
    rename(font)
    font.flavor = "woff2"
    font.save(OUTPUT)
    print(f"wrote {OUTPUT.name} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
