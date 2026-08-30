/**
 * Parsers for Unicode's two Bidirectional Algorithm conformance files.
 *
 * Data only — nothing here implements or knows about UAX #9. See `./README.md`
 * for the Unicode version, the source URLs, and why the fixtures are gzipped.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

import type { BidiClass } from '../types';

/**
 * Doubles as the runtime membership test for the class names in `BidiTest.txt`.
 * `Record<BidiClass, true>` is exhaustive in both directions, so this cannot
 * drift from the union.
 */
const BIDI_CLASS_NAMES: Record<BidiClass, true> = {
  L: true, R: true, AL: true,
  EN: true, ES: true, ET: true, AN: true, CS: true, NSM: true, BN: true,
  B: true, S: true, WS: true, ON: true,
  LRE: true, RLE: true, LRO: true, RLO: true, PDF: true,
  LRI: true, RLI: true, FSI: true, PDI: true,
};

const isBidiClass = (s: string): s is BidiClass =>
  Object.prototype.hasOwnProperty.call(BIDI_CLASS_NAMES, s);

/** Bitset values used by `BidiTestCase.paragraphDirections`. */
export const AUTO_LTR = 1;
/** @see AUTO_LTR */
export const LTR = 2;
/** @see AUTO_LTR */
export const RTL = 4;

/** One line of `BidiCharacterTest.txt`. */
export interface CharacterTestCase {
  /** Field 0, as scalar values. */
  codePoints: number[];
  /** Field 1. 0 = LTR, 1 = RTL, 2 = auto-LTR by rules P2/P3. */
  direction: 0 | 1 | 2;
  /** Field 2, the resolved paragraph embedding level. */
  paragraphLevel: number;
  /**
   * Field 3, one entry per code point. `null` is the file's `x`: the character
   * is removed by rule X9 and has no resolved level.
   */
  levels: readonly (number | null)[];
  /** Field 4: indices into `codePoints`, left to right, `null`-level ones omitted. */
  visualOrder: readonly number[];
}

/** One data line of `BidiTest.txt`, resolved against the `@Levels`/`@Reorder` in force. */
export interface BidiTestCase {
  /** `Bidi_Class` names, e.g. `['L', 'R', 'EN']`. There are no code points in this file. */
  classes: BidiClass[];
  /** Bitset of the paragraph directions this case applies to: {@link AUTO_LTR} | {@link LTR} | {@link RTL}. */
  paragraphDirections: number;
  /** The `@Levels` in force, one entry per class. `null` is the file's `x`. */
  levels: readonly (number | null)[];
  /** The `@Reorder` in force: indices into `classes`, left to right, `null`-level ones omitted. */
  visualOrder: readonly number[];
}

const splitTokens = (s: string): string[] => (s === '' ? [] : s.split(/\s+/));

function parseLevels(field: string, lineNo: number): (number | null)[] {
  return splitTokens(field).map((t) => {
    if (t === 'x') return null;
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0) throw new Error(`line ${lineNo}: bad level ${JSON.stringify(t)}`);
    return n;
  });
}

function parseIndices(field: string, lineNo: number): number[] {
  return splitTokens(field).map((t) => {
    const n = Number(t);
    if (!Number.isInteger(n) || n < 0) throw new Error(`line ${lineNo}: bad index ${JSON.stringify(t)}`);
    return n;
  });
}

/**
 * `BidiCharacterTest.txt`: five `;`-separated fields per line, no state carried
 * between lines.
 */
export function parseBidiCharacterTest(text: string): CharacterTestCase[] {
  const cases: CharacterTestCase[] = [];
  const lines = text.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '' || line.startsWith('#')) continue;

    const lineNo = i + 1;
    const fields = line.split(';');
    if (fields.length !== 5) throw new Error(`line ${lineNo}: expected 5 fields, got ${fields.length}`);

    const codePoints = splitTokens(fields[0]!.trim()).map((t) => {
      const n = Number.parseInt(t, 16);
      if (!Number.isInteger(n)) throw new Error(`line ${lineNo}: bad code point ${JSON.stringify(t)}`);
      return n;
    });

    const direction = Number(fields[1]!.trim());
    if (direction !== 0 && direction !== 1 && direction !== 2) {
      throw new Error(`line ${lineNo}: bad direction ${JSON.stringify(fields[1])}`);
    }

    const paragraphLevel = Number(fields[2]!.trim());
    if (!Number.isInteger(paragraphLevel)) {
      throw new Error(`line ${lineNo}: bad paragraph level ${JSON.stringify(fields[2])}`);
    }

    const levels = parseLevels(fields[3]!.trim(), lineNo);
    if (levels.length !== codePoints.length) {
      throw new Error(`line ${lineNo}: ${codePoints.length} code points but ${levels.length} levels`);
    }

    cases.push({
      codePoints,
      direction,
      paragraphLevel,
      levels,
      visualOrder: parseIndices(fields[4]!.trim(), lineNo),
    });
  }

  return cases;
}

/**
 * `BidiTest.txt`: `@Levels:` and `@Reorder:` are state lines that apply to every
 * following data line until the next one of the same kind. They are tracked
 * independently — a fresh `@Levels` does not reset the `@Reorder` in force —
 * and any other `@` line is ignored, both per the file's own header.
 *
 * The `levels` and `visualOrder` arrays are shared by every case in a block and
 * frozen, which is why they are `readonly`: 490k cases resolve to ~1.3k distinct
 * arrays.
 */
export function parseBidiTest(text: string): BidiTestCase[] {
  const cases: BidiTestCase[] = [];
  const lines = text.split('\n');

  let levels: readonly (number | null)[] | null = null;
  let visualOrder: readonly number[] | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line === '' || line.startsWith('#')) continue;

    const lineNo = i + 1;

    if (line.startsWith('@')) {
      if (line.startsWith('@Levels:')) {
        levels = Object.freeze(parseLevels(line.slice('@Levels:'.length).trim(), lineNo));
      } else if (line.startsWith('@Reorder:')) {
        visualOrder = Object.freeze(parseIndices(line.slice('@Reorder:'.length).trim(), lineNo));
      }
      continue;
    }

    const semi = line.indexOf(';');
    if (semi === -1) throw new Error(`line ${lineNo}: data line has no ';'`);
    if (levels === null || visualOrder === null) {
      throw new Error(`line ${lineNo}: data line before both @Levels and @Reorder`);
    }

    const classes = splitTokens(line.slice(0, semi).trim()).map((t) => {
      if (!isBidiClass(t)) throw new Error(`line ${lineNo}: unknown Bidi_Class ${JSON.stringify(t)}`);
      return t;
    });
    if (classes.length !== levels.length) {
      throw new Error(`line ${lineNo}: ${classes.length} classes but @Levels has ${levels.length}`);
    }

    const paragraphDirections = Number.parseInt(line.slice(semi + 1).trim(), 16);
    if (!Number.isInteger(paragraphDirections) || paragraphDirections <= 0) {
      throw new Error(`line ${lineNo}: bad paragraph-direction bitset`);
    }

    cases.push({ classes, paragraphDirections, levels, visualOrder });
  }

  return cases;
}

/**
 * Two bundler hazards, neither of which shows up in a plain `node` run: Vite
 * statically rewrites `new URL('./x', import.meta.url)` into an asset
 * reference, and its SSR transform sets `import.meta.url` from the module id,
 * which is root-relative for a file inside the project root. Test entry files
 * are exempt from the second, which is why the naive form works in a
 * `*.test.ts` and not here.
 */
const FIXTURE_DIR = ((): string => {
  const fromModule = dirname(fileURLToPath(import.meta.url));
  const candidates = [fromModule, resolve(process.cwd(), fromModule.replace(/^\/+/, ''))];
  const found = candidates.find((d) => existsSync(join(d, 'BidiTest.txt.gz')));
  if (found === undefined) {
    throw new Error(`bidi conformance fixtures not found; looked in ${candidates.join(', ')}`);
  }
  return found;
})();

const readFixture = (name: string): string =>
  gunzipSync(readFileSync(join(FIXTURE_DIR, `${name}.gz`))).toString('utf8');

/** Read and parse the committed `BidiCharacterTest.txt.gz`. */
export const loadBidiCharacterTest = (): CharacterTestCase[] =>
  parseBidiCharacterTest(readFixture('BidiCharacterTest.txt'));

/** Read and parse the committed `BidiTest.txt.gz`. */
export const loadBidiTest = (): BidiTestCase[] => parseBidiTest(readFixture('BidiTest.txt'));

/** The raw decompressed text, for a test that wants to read specific source lines. */
export const readBidiCharacterTestText = (): string => readFixture('BidiCharacterTest.txt');
/** @see readBidiCharacterTestText */
export const readBidiTestText = (): string => readFixture('BidiTest.txt');
