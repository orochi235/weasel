/** Reading the runs of a `<text>`: its text and its `<tspan>` children. */

import { type StyledRun, type TextStyle, resolveScreenLength } from '@weasel-js/core';
import { holdsOnlyText, joinLines, type LineTracker, statesLines, warnUnreadPositions } from './tspanLines';
import { placeTspanRun, TextShifts } from './glyphShifts';
import { type Moves, movesOf, NO_MOVES, raiseRuns, risesOver, TextMoves } from './glyphRises';
import { collapseRunWhitespace, preservesSpace } from './textWhitespace';
import { fontSizeOf } from './fontSize';
import type { GradientTable } from './gradients';
import { deriveStyle, ownProp, ownValue, resolveCurrentColor, type StyleContext } from './cascade';
import { readProperty } from './properties';
import { readStroke, isNonScalingStroke, ownStrokeStyle, coreStroke } from './readPaint';

const glyphCount = (text: string): number => Array.from(text).length;

/**
 * The element's runs, with a `\n` wherever a `<tspan>` opens a new line:
 * text nodes become plain runs, and `<tspan>` elements become runs carrying
 * their attribute overrides. Glyphs moved off their line are raised or
 * lowered by `baselineShift`. `lead` is how far a leading `dx` moves the text.
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
  const raise = (text: string, own: Moves, inherited: Moves, placed: boolean): void =>
    raiseRuns(runLines[runLines.length - 1], risesOver(Array.from(text), own, inherited, tracker, placed), fontSize, textStyle);
  let leading = 0;
  let lead = 0;
  if (holdsOnlyText(el) && (el.hasAttribute('dx') || el.hasAttribute('x'))) {
    const t = el.textContent ?? '';
    if (t) {
      lead = placeTspanRun(el, { text: t, ...inheritedShift }, runLines, textStyle, onWarn);
      raise(t, NO_MOVES, moves.take(glyphCount(t)), false);
    }
  } else for (let i = 0, shifts = new TextShifts(el, onWarn); i < el.childNodes.length; i++) {
    const child = el.childNodes[i];
    const bare = child.nodeType === 3 /* TEXT_NODE */
      || (child.nodeType === 1 && (child as Element).tagName.toLowerCase() !== 'tspan');
    if (bare) {
      if (child.nodeType === 1) onWarn(`<text> child <${(child as Element).tagName}> not supported; flattening text content`);
      const t = child.textContent ?? '';
      if (!t) continue;
      lead += shifts.place({ text: t, ...inheritedShift }, runLines, textStyle);
      raise(t, NO_MOVES, moves.take(glyphCount(t)), false);
    } else if (child.nodeType === 1 /* ELEMENT_NODE */) {
      const sp = child as Element;
      warnUnreadPositions(sp, onWarn);
      const run = readTspanRun(sp, gradients, leafStyle, onWarn);
      const inherited = moves.take(glyphCount(run.text));
      const afterText = runLines.some((line) => line.some((r) => r.text.trim() !== ''));
      const lines = tracker.startsLine(sp, afterText, { y: inherited.y[0], dy: inherited.dy[0] });
      // A tspan opening the text steps down from nothing, so it breaks no
      // line unless it says how many it stepped.
      if (runLines.length === 1 && runLines[0].length === 0 && statesLines(sp)) leading = lines;
      else for (let n = 0; n < lines; n++) runLines.push([]);
      lead += placeTspanRun(sp, run, runLines, textStyle, onWarn, shifts.take(run));
      raise(run.text, movesOf(sp, onWarn), inherited, true);
    }
  }
  if (!preservesSpace(el)) for (const line of runLines) collapseRunWhitespace(line);
  return { runs: joinLines(runLines, leading), lead };
}

function readTspanRun(
  el: Element,
  gradients: GradientTable,
  style: StyleContext,
  onWarn: (m: string) => void,
): StyledRun {
  const text = el.textContent ?? '';
  const run: StyledRun = { text };
  const fw = ownValue(el, 'font-weight', onWarn);
  // 700 is the bold flag's own spelling; any other weight is the run's.
  if (fw === 'bold' || fw === 'bolder' || fw === 700) run.bold = true;
  else if (fw === 'normal') run.fontWeight = 400;
  else if (typeof fw === 'number') run.fontWeight = fw;
  if (ownValue(el, 'font-style', onWarn) === 'italic') run.italic = true;
  const ff = ownValue(el, 'font-family', onWarn);
  if (ff) run.fontFamily = ff;
  const size = ownValue(el, 'font-size', onWarn);
  if (size?.fontSize != null) run.fontSize = size.fontSize;
  if (size?.fontScale != null) run.fontScale = size.fontScale;
  const tspanStyle = deriveStyle(style, el);
  const ls = ownValue(el, 'letter-spacing', onWarn, fontSizeOf(tspanStyle));
  if (ls != null) run.letterSpacing = ls;
  const shift = ownValue(el, 'baseline-shift', onWarn);
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
  const fillAttr = resolveCurrentColor(ownProp(el, 'fill'), tspanStyle);
  if (fillAttr) {
    const parsed = readProperty('fill', fillAttr);
    if (parsed?.kind === 'none') {
      run.fill = null;
    } else if (parsed?.kind === 'solid') {
      run.fill = { paint: { kind: 'solid', color: parsed.color } };
    } else if (parsed?.kind === 'ref') {
      const paint = gradients.get(parsed.id);
      if (paint) run.fill = { paint };
      else if (parsed.fallback) run.fill = { paint: { kind: 'solid', color: parsed.fallback.color } };
    }
  }
  // Own attributes only — see `ownStrokeStyle`.
  const stroke = coreStroke(readStroke(ownStrokeStyle(el, tspanStyle), gradients, onWarn, isNonScalingStroke(el)));
  if (stroke) run.stroke = stroke;
  return run;
}
