"""Build Oswald Tabular: Oswald's ten digits, each centered in one shared advance
at every weight, plus a figure space that wide, renamed so it can sit in front of
Oswald in a font stack.

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


def subset_digits(font: TTFont) -> None:
    opts = subset.Options()
    opts.layout_features = []
    opts.hinting = False
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    s = subset.Subsetter(opts)
    s.populate(unicodes=[ord(c) for c in DIGITS])
    s.subset(font)


def tabulate(font: TTFont) -> None:
    """Give every digit the widest digit's advance, at the default weight and at
    each master, shifting each outline by half the difference so it stays centered."""
    cmap = font.getBestCmap()
    names = [cmap[ord(c)] for c in DIGITS]
    glyf, hmtx, gvar = font["glyf"], font["hmtx"], font["gvar"].variations

    vmtx = font["vmtx"].metrics if "vmtx" in font else None
    for g in names:
        coords, ctrl = glyf._getCoordinatesAndControls(g, hmtx.metrics, vmtx)
        for t in gvar[g]:
            t.calcInferredDeltas(coords, ctrl.endPts)

    target = max(hmtx[g][0] for g in names)
    # Widest advance at each master, as a delta from `target`.
    regions: dict[tuple, int] = {}
    for g in names:
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
