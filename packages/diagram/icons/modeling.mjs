// The UML and ERD stencils. Coordinates follow containers.mjs: an odd multiple
// of GRID lands a 1.5 stroke on a 16px glyph's pixel center at 1x and on pixel
// edges at 2x. Diagonals (the actor's limbs, the abstract slash) cannot.

const GRID = 0.625;
const at = (k) => k * GRID;
const n = (v) => String(Math.round(v * 1e4) / 1e4);
const P = (x, y) => `${n(x)} ${n(y)}`;
const rect = (l, t, r, b) => `M${P(l, t)}H${n(r)}V${n(b)}H${n(l)}Z`;
const line = (x0, y0, x1, y1) => `M${P(x0, y0)}L${P(x1, y1)}`;
const circle = (cx, cy, r) => `M${P(cx - r, cy)}A${n(r)} ${n(r)} 0 1 1 ${P(cx + r, cy)}A${n(r)} ${n(r)} 0 1 1 ${P(cx - r, cy)}Z`;

/** A class: a portrait box of three compartments, the name's the shortest. */
const CLASS = { l: at(7), r: at(25), t: at(3), b: at(29) };
const CLASS_RULES = [at(13), at(21)];
const classFrame = rect(CLASS.l, CLASS.t, CLASS.r, CLASS.b);
const classRules = CLASS_RULES.map((y) => line(CLASS.l, y, CLASS.r, y)).join('');
const classGlyph = (inner = '') => ({ d: classFrame + classRules + inner, fill: classFrame, join: 'miter' });

/** The abstract class's slash leans like an italic stroke, two down for one across, clear of the rules. */
const slash = line(at(15), 6.5, at(17), 4);

/** A vertical stroke on the glyph's midline would fall between two 1x pixels, so the figures
 *  stand one GRID step right of it, as containers.mjs's lane divider does. */
const MID = at(17);

/** A lollipop: the provided-interface symbol. */
const HEAD = { cx: MID, cy: at(9), r: at(6) };
const lollipop = circle(HEAD.cx, HEAD.cy, HEAD.r) + line(MID, HEAD.cy + HEAD.r, MID, at(29));

const PKG = { l: at(5), r: at(27), tab: at(15), top: at(5), body: at(9), b: at(27) };
const pkgFill = `M${P(PKG.l, PKG.top)}H${n(PKG.tab)}V${n(PKG.body)}H${n(PKG.r)}V${n(PKG.b)}H${n(PKG.l)}Z`;
const pkg = { d: pkgFill + line(PKG.l, PKG.body, PKG.tab, PKG.body), fill: pkgFill, join: 'miter' };

const NOTE = { l: at(7), r: at(25), t: at(3), b: at(29), fold: at(8) };
const noteFill = `M${P(NOTE.l, NOTE.t)}H${n(NOTE.r - NOTE.fold)}L${P(NOTE.r, NOTE.t + NOTE.fold)}V${n(NOTE.b)}H${n(NOTE.l)}Z`;
const note = {
  d: noteFill + `M${P(NOTE.r - NOTE.fold, NOTE.t)}V${n(NOTE.t + NOTE.fold)}H${n(NOTE.r)}`,
  fill: noteFill,
  join: 'miter',
};

const ACTOR = { head: at(7), r: at(4), hip: at(21), arms: at(15), foot: at(29), reach: at(7) };
const actor = {
  d: circle(MID, ACTOR.head, ACTOR.r) + line(MID, ACTOR.head + ACTOR.r, MID, ACTOR.hip)
    + line(MID - ACTOR.reach, ACTOR.arms, MID + ACTOR.reach, ACTOR.arms)
    + `M${P(MID - at(6), ACTOR.foot)}L${P(MID, ACTOR.hip)}L${P(MID + at(6), ACTOR.foot)}`,
  fill: circle(MID, ACTOR.head, ACTOR.r),
};

/** A component: a box with two tabs straddling its left edge, the edge broken under each tab. */
const COMP = { l: at(9), r: at(29), t: at(5), b: at(27), tabL: at(5), tabR: at(13), tabs: [[at(9), at(13)], [at(19), at(23)]] };
const compFrame = rect(COMP.l, COMP.t, COMP.r, COMP.b);
const [[t1, b1], [t2, b2]] = COMP.tabs;
const component = {
  d: `M${P(COMP.l, t1)}V${n(COMP.t)}H${n(COMP.r)}V${n(COMP.b)}H${n(COMP.l)}V${n(b2)}`
    + line(COMP.l, b1, COMP.l, t2)
    + COMP.tabs.map(([t, b]) => rect(COMP.tabL, t, COMP.tabR, b)).join(''),
  fill: compFrame,
  join: 'miter',
};

/** An entity: a table, a header band over two field lines. */
const ENT = { l: at(3), r: at(29), t: at(5), head: at(11), b: at(29) };
const entFrame = rect(ENT.l, ENT.t, ENT.r, ENT.b);
const fields = [at(17), at(23)].map((y) => line(at(7), y, at(21), y)).join('');
const entity = { d: entFrame + line(ENT.l, ENT.head, ENT.r, ENT.head) + fields, fill: entFrame, join: 'miter' };

const WEAK = { outer: [at(3), at(7), at(29), at(27)], inner: [at(9), at(13), at(23), at(21)] };
const weakOuter = rect(...WEAK.outer);
const weakEntity = { d: weakOuter + rect(...WEAK.inner), fill: weakOuter, join: 'miter' };

export const UML = {
  'uml-class': classGlyph(),
  'uml-interface': { d: lollipop, fill: circle(HEAD.cx, HEAD.cy, HEAD.r) },
  'uml-abstract': classGlyph(slash),
  'uml-package': pkg,
  'uml-note': note,
  'uml-actor': actor,
  'uml-component': component,
};

export const ERD = {
  'erd-entity': entity,
  'erd-weak-entity': weakEntity,
};
