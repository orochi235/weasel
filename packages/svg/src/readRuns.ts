/** Reading the runs of a `<text>`: its text and its `<tspan>` children. */

import { resolveScreenLength } from '@weasel-js/core';
import { type StyledRun, type TextStyle } from '@weasel-js/text';
import { holdsOnlyText, joinLines, LineTracker, statesLines } from './tspanLines';
import { TextTurns, turnRuns, turnsOf } from './glyphTurns';
import { type Piece, placeTspanRun, TextShifts } from './glyphShifts';
import { type Moves, movesOf, NO_MOVES, raiseRuns, risesOver, TextMoves } from './glyphRises';
import { collapseRunWhitespace, preservesSpace } from './textWhitespace';
import { fontSizeOf } from './fontSize';
import { ownLang } from './textLang';
import type { GradientTable } from './readGradients';
import { deriveStyle, ownProp, ownValue, setsOwn, styleValue, visibilityHides, type StyleContext } from './cascade';
import { shiftInEms } from './properties';
import { readStroke, isNonScalingStroke, setsOwnStroke, coreStroke, coreTextFill } from './readPaint';
import { withOutlinedStroke } from './strokeOutlineSvg';
import { tspanStretches } from './nestedTspans';

const glyphCount = (text: string): number => Array.from(text).length;

/**
 * The element's runs, with a `\n` wherever a `<tspan>` opens a new line:
 * text nodes become plain runs, and `<tspan>` elements become runs carrying
 * their attribute overrides. Glyphs moved off their line are raised or
 * lowered by `baselineShift`, and turned glyphs take `rotate`. `lead` is how far a leading `dx` moves the text.
 */
export function readRuns(
  el: Element,
  tracker: LineTracker,
  inheritedShift: Pick<StyledRun, 'script' | 'baselineShift'>,
  textStyle: TextStyle,
  gradients: GradientTable,
  leafStyle: StyleContext,
  onWarn: (m: string) => void,
): { runs: StyledRun[]; lead: number } {
  const runLines: StyledRun[][] = [[]];
  const fontSize = resolveScreenLength(textStyle.fontSize ?? 16, 1);
  const moves = new TextMoves(el, onWarn);
  const turns = new TextTurns(el, onWarn);
  const turn = (text: string, own?: readonly number[]): void =>
    turnRuns(runLines[runLines.length - 1], turns.take(glyphCount(text), own));
  const raise = (text: string, own: Moves, inherited: Moves, placed: boolean): void =>
    raiseRuns(runLines[runLines.length - 1], risesOver(Array.from(text), own, inherited, tracker, placed), fontSize, textStyle);
  let leading = 0;
  let lead = 0;
  if (holdsOnlyText(el) && (el.hasAttribute('dx') || el.hasAttribute('x'))) {
    const t = el.textContent ?? '';
    if (t) {
      lead = placeTspanRun(el, { text: t, ...inheritedShift }, runLines, textStyle, onWarn);
      raise(t, NO_MOVES, moves.take(glyphCount(t)), false);
      turn(t);
    }
  } else {
    // Every run is read before any is placed: the text's `x` list is folded
    // into spacing by measuring together the runs it reaches.
    const styled = new ChainStyle(gradients, leafStyle, onWarn);
    const pieces = Array.from(el.childNodes).flatMap((child): (Piece & { hidden: boolean })[] => {
      if (child.nodeType === 1 && (child as Element).tagName.toLowerCase() === 'tspan') {
        return tspanStretches(child as Element, onWarn).map(({ at, chain, text }) => {
          const run = styled.run(chain, text);
          const shifted = chain.some((e) => ownProp(e, 'baseline-shift') != null);
          return { tspan: at, run: shifted ? run : { ...run, ...inheritedShift }, hidden: visibilityHides(styled.style(chain)) };
        });
      }
      if (child.nodeType === 1) onWarn(`<text> child <${(child as Element).tagName}> not supported; flattening text content`);
      else if (child.nodeType !== 3 /* TEXT_NODE */) return [];
      const t = child.textContent ?? '';
      return t ? [{ tspan: null, run: { text: t, ...inheritedShift }, hidden: visibilityHides(leafStyle) }] : [];
    }).map(({ tspan, run, hidden }) => ({ tspan, run: hidden ? unpainted(run) : run }));
    const shifts = new TextShifts(el, onWarn, pieces, textStyle, lineOpenings(el, pieces));
    for (const { tspan: sp, run } of pieces) {
      if (!sp) {
        lead += shifts.place(run, runLines, textStyle);
        raise(run.text, NO_MOVES, moves.take(glyphCount(run.text)), false);
        turn(run.text);
        continue;
      }
      const inherited = moves.take(glyphCount(run.text));
      const afterText = runLines.some((line) => line.some((r) => r.text.trim() !== ''));
      const lines = tracker.startsLine(sp, afterText, { y: inherited.y[0], dy: inherited.dy[0] });
      // A tspan opening the text steps down from nothing, so it breaks no
      // line unless it says how many it stepped.
      if (runLines.length === 1 && runLines[0].length === 0 && statesLines(sp)) leading = lines;
      else for (let n = 0; n < lines; n++) runLines.push([]);
      lead += placeTspanRun(sp, run, runLines, textStyle, onWarn, shifts.take(run));
      raise(run.text, movesOf(sp, onWarn), inherited, true);
      turn(run.text, turnsOf(sp, onWarn));
    }
  }
  if (!preservesSpace(el)) for (const line of runLines) collapseRunWhitespace(line);
  return { runs: joinLines(runLines, leading), lead };
}

/** `run` taking its place on the line and painting nothing, as a hidden glyph does. */
function unpainted(run: StyledRun): StyledRun {
  return { ...run, fill: null, stroke: {} };
}

/** For each of `pieces`, whether it opens a line, as `readRuns` walking them
 *  in order will find: its `x` list has to be read before that walk. */
function lineOpenings(el: Element, pieces: readonly Piece[]): boolean[] {
  const quiet = (): void => {};
  const tracker = new LineTracker(el, quiet);
  const moves = new TextMoves(el, quiet);
  let afterText = false;
  return pieces.map(({ tspan, run }) => {
    const glyphs = Array.from(run.text);
    const inherited = moves.take(glyphs.length);
    const from = tracker.baseline;
    if (tspan) tracker.startsLine(tspan, afterText, { y: inherited.y[0], dy: inherited.dy[0] });
    const opens = tracker.baseline !== from;
    risesOver(glyphs, tspan ? movesOf(tspan, quiet) : NO_MOVES, inherited, tracker, tspan !== null);
    if (run.text.trim() !== '') afterText = true;
    return opens;
  });
}

/** The run style a chain of nested tspans gives its text, outermost first, each element read once. */
class ChainStyle {
  private readonly runs = new Map<Element, StyledRun>();
  private readonly styles = new Map<Element, StyleContext>();

  constructor(
    private readonly gradients: GradientTable,
    private readonly leafStyle: StyleContext,
    private readonly onWarn: (m: string) => void,
  ) {}

  /** The cascade on the innermost of `chain`. */
  style(chain: readonly Element[]): StyleContext {
    let style = this.leafStyle;
    for (const e of chain) {
      let own = this.styles.get(e);
      if (own === undefined) this.styles.set(e, (own = deriveStyle(style, e)));
      style = own;
    }
    return style;
  }

  /** `text`'s run under `chain`: each tspan's own overrides over the ones around it. */
  run(chain: readonly Element[], text: string): StyledRun {
    const out: StyledRun = { text };
    chain.forEach((e, i) => {
      let own = this.runs.get(e);
      if (own === undefined) this.runs.set(e, (own = readTspanRun(e, this.gradients, this.style(chain.slice(0, i)), this.onWarn)));
      overlay(out, own);
    });
    return out;
  }
}

/** Fields one property sets together: a run that sets any of a group replaces the whole group. */
const TOGETHER: readonly (readonly (keyof StyledRun)[])[] = [['bold', 'fontWeight'], ['fontSize', 'fontScale'], ['script', 'baselineShift']];

function overlay(run: StyledRun, over: StyledRun): void {
  for (const group of TOGETHER) {
    if (group.some((k) => over[k] !== undefined)) for (const k of group) delete run[k];
  }
  Object.assign(run, Object.fromEntries(Object.entries(over).filter(([k, v]) => k !== 'text' && v !== undefined)));
}

function readTspanRun(
  el: Element,
  gradients: GradientTable,
  style: StyleContext,
  onWarn: (m: string) => void,
): StyledRun {
  const run: StyledRun = { text: '' };
  const tspanStyle = deriveStyle(style, el);
  const own = ownValue(el, 'font-weight', onWarn);
  // `bolder` and `lighter` are read as the weight they compute to over the text's.
  const fw = own === 'bolder' || own === 'lighter' ? styleValue(tspanStyle, 'font-weight') : own;
  // 700 is the bold flag's own spelling; any other weight is the run's.
  if (fw === 'bold' || fw === 700) run.bold = true;
  else if (fw === 'normal') run.fontWeight = 400;
  else if (typeof fw === 'number') run.fontWeight = fw;
  const fs = ownValue(el, 'font-style', onWarn);
  if (fs) run.italic = fs === 'italic';
  const ff = ownValue(el, 'font-family', onWarn);
  if (ff) run.fontFamily = ff;
  const size = ownValue(el, 'font-size', onWarn);
  if (size?.fontSize != null) run.fontSize = size.fontSize;
  if (size?.fontScale != null) run.fontScale = size.fontScale;
  const ls = ownValue(el, 'letter-spacing', onWarn, fontSizeOf(tspanStyle));
  if (ls != null) run.letterSpacing = ls;
  const read = ownValue(el, 'baseline-shift', onWarn, fontSizeOf(tspanStyle));
  const shift = read && shiftInEms(read, fontSizeOf(style));
  if (shift?.script != null) run.script = shift.script;
  if (shift?.baselineShift != null) run.baselineShift = shift.baselineShift;
  const decoration = ownValue(el, 'text-decoration', onWarn);
  if (decoration?.underline) run.underline = true;
  if (decoration?.strikethrough) run.strikethrough = true;
  if (decoration?.overline) run.overline = true;
  const transform = ownValue(el, 'text-transform', onWarn);
  if (transform) run.textTransform = transform;
  const variant = ownValue(el, 'font-variant', onWarn);
  if (variant) run.fontVariantCaps = variant;
  const lang = ownLang(el)?.trim();
  if (lang) run.lang = lang;
  // Own attributes only, as for the stroke: an inherited fill is the node's already.
  if (setsOwn(el, 'fill') || setsOwn(el, 'fill-opacity')) {
    run.fill = coreTextFill(tspanStyle, gradients, onWarn);
  }
  // Only where it overrides one — see `setsOwnStroke`.
  if (setsOwnStroke(el)) {
    const stroke = coreStroke(withOutlinedStroke(el, readStroke(tspanStyle, gradients, onWarn, isNonScalingStroke(el))));
    // A stroke with no paint draws nothing, so it still replaces the node's.
    run.stroke = stroke ?? {};
  }
  return run;
}
