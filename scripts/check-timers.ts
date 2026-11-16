/**
 * A `setTimeout` past 2^31 − 1 ms fires at once, and so does one given `Infinity`, `NaN`, or a negative delay, so a
 * wait taken from an option, a measurement, or a sum fires early on exactly the input that meant "long" or "never".
 * `after` from `@weasel-js/registry` waits those out. This fails on a `setTimeout` call in package or app source
 * whose delay is not fixed in the source: a number, a SCREAMING_CASE constant, an entry of one, or arithmetic on
 * those.
 *
 * To add a site to the allowlist, say in the entry why its delay cannot reach the limit.
 *
 * Runs under tsx so it shares the root tsconfig's resolution, like its siblings.
 */

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { walk } from './lib/cssBlocks.ts';

export interface Offender {
  readonly file: string;
  readonly line: number;
  readonly text: string;
}

/** Paths whose `setTimeout` delays may be computed, and why none reaches the limit. */
const ALLOWED = new Map<string, string>([
  ['packages/registry/src/after.ts', 'the wrapper itself: each timer it sets is capped at the limit'],
  ['packages/audio/src/audioTime.ts', 'the default timer pair: every delay `atAudioTime` asks it for is capped at the limit'],
  ['packages/audio/src/testing/renderEngine.ts', 'a test engine\'s timer pair: every delay `atAudioTime` asks it for is capped at the limit'],
  ['packages/audio/src/tickTimer.ts', 'the scheduler\'s pass timer: its delays are the lookahead interval, a few ms'],
  ['packages/forge/src/vite/watchProbe.ts', 'an unref\'d Node timer, which `after` cannot give; its wait is the probe\'s own constant or a test\'s'],
  ['packages/labkit/src/loupe/lens/GridCanvas.tsx', '`useCaptureDelay` answers 0 or LENS_REST_MS'],
  ['packages/labkit/src/loupe/lens/LensSlot.tsx', '`useCaptureDelay` answers 0 or LENS_REST_MS'],
  ['packages/labkit/src/trial/watch3d.ts', 'the wait is an entry of the RETRIES_MS table'],
  ['apps/devtools-extension/src/background/badge.ts', 'the wait is an entry of the BADGE_DELAYS table'],
]);

const CONSTANT = /^[A-Z][A-Z0-9_]*$/;

/** Whether `delay` is fixed in the source, so whoever wrote it chose its size. */
function isFixed(delay: ts.Expression): boolean {
  if (ts.isNumericLiteral(delay)) return true;
  if (ts.isParenthesizedExpression(delay)) return isFixed(delay.expression);
  if (ts.isPrefixUnaryExpression(delay)) return isFixed(delay.operand);
  if (ts.isIdentifier(delay)) return CONSTANT.test(delay.text);
  if (ts.isPropertyAccessExpression(delay)) return ts.isIdentifier(delay.expression) && CONSTANT.test(delay.expression.text);
  if (ts.isElementAccessExpression(delay)) return ts.isIdentifier(delay.expression) && CONSTANT.test(delay.expression.text);
  if (ts.isBinaryExpression(delay)) return isFixed(delay.left) && isFixed(delay.right);
  return false;
}

const isSetTimeout = (callee: ts.Expression): boolean =>
  (ts.isIdentifier(callee) && callee.text === 'setTimeout') ||
  (ts.isPropertyAccessExpression(callee) && callee.name.text === 'setTimeout');

export function timerOffenders(path: string, source: string): Offender[] {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: Offender[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && isSetTimeout(node.expression)) {
      const delay = node.arguments[1];
      if (delay && !isFixed(delay)) {
        out.push({ file: path, line: file.getLineAndCharacterOfPosition(delay.getStart(file)).line + 1, text: delay.getText(file) });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
}

const isSource = (p: string): boolean =>
  /\.(ts|tsx)$/.test(p) &&
  !/\.(test|spec|stories)\.(ts|tsx)$/.test(p) &&
  !p.endsWith('.d.ts') &&
  !/(^|\/)(node_modules|dist|dist-examples|examples)\//.test(p);

if (process.argv[1]?.endsWith('check-timers.ts')) {
  const root = join(import.meta.dirname, '..');
  const files = [...walk(join(root, 'packages')), ...walk(join(root, 'apps'))]
    .map((p) => relative(root, p))
    .filter(isSource);
  const found = files.flatMap((p) => timerOffenders(p, readFileSync(join(root, p), 'utf8')));
  const bad = found.filter((o) => !ALLOWED.has(o.file));
  const stale = [...ALLOWED.keys()].filter((p) => !found.some((o) => o.file === p));
  for (const o of bad) console.error(`${o.file}:${o.line}  setTimeout with a computed delay (${o.text}); wait with \`after\` from @weasel-js/registry`);
  for (const p of stale) console.error(`${p}  allowed a computed setTimeout delay it no longer has; remove its entry in scripts/check-timers.ts`);
  console.log(`${files.length} source files, ${bad.length} computed timer delay(s)`);
  process.exit(bad.length === 0 && stale.length === 0 ? 0 : 1);
}
