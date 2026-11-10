/**
 * Property tests of the route grammars: every parsed route formats to a string that parses back to it, any
 * string that parses is a fixpoint of format-then-parse, whitespace between slots means nothing, key routes
 * round-trip, and folding shift pairs keeps the set of shift states each route accepts.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { runs, timeoutFor } from '../pbt.fixture';
import { GESTURE_DESCRIPTORS, getGestureDescriptor, type GestureName } from './gestures';
import { formatKeyRoute, parseKeyRoute, type OptionalMod } from './keyRouteGrammar';
import {
  RESERVED_ID_NAMES, RESERVED_ID_PREFIXES, VALID_MOD_NAMES, collapseShiftPairs, formatPhaseAtom, formatRoute,
  parseRoute, type ModRequirement, type ParsedModifiers, type ParsedRoute, type PhaseAtom,
} from './routeGrammar';

const RUNS = 300;

const charsOf = (chars: string, max: number): fc.Arbitrary<string> =>
  fc.string({ unit: fc.constantFrom(...chars), minLength: 1, maxLength: max });

const toolId = charsOf('abrz09-_.() =>+?/', 6)
  .filter((s) => s === s.trim() && !RESERVED_ID_NAMES.has(s) && !RESERVED_ID_PREFIXES.has(s[0]!));
const atom: fc.Arbitrary<PhaseAtom> = fc.record({
  channel: fc.oneof(fc.constantFrom('&', '*'), toolId),
  phase: fc.constantFrom('initial', 'engaged', '*'),
});

/** A free arg the grammar can spell: its slot closes at a `)` before whitespace, a sigil, `=`, or the end. */
const freeArg = charsOf('aZ1 ()?+=|/*я', 6).filter((s) => !/\)[\s+?=]/.test(s));
const target = fc.oneof(
  fc.constantFrom('*', 'empty', 'selected-body', 'kind:rect', 'kind:app:note:selected', 'affordance:handle:nw'),
  charsOf('ak:=>()*-', 6).filter((s) => !RESERVED_ID_PREFIXES.has(s[0]!)),
);
const requirement = fc.constantFrom<ModRequirement | undefined>(undefined, 'required', 'optional');
const mods: fc.Arbitrary<ParsedModifiers> = fc.tuple(...VALID_MOD_NAMES.map(() => requirement)).map((reqs) => {
  const out: ParsedModifiers = {};
  VALID_MOD_NAMES.forEach((name, i) => { if (reqs[i]) out[name] = reqs[i]; });
  return out;
});

const route: fc.Arbitrary<ParsedRoute> = fc.constantFrom(...GESTURE_DESCRIPTORS.map((d) => d.name)).chain((gesture: GestureName) => {
  const desc = getGestureDescriptor(gesture);
  const arg = !desc.arg ? fc.constant(undefined)
    : desc.arg.values === 'free' ? fc.oneof(fc.constant('*'), freeArg)
      : fc.constantFrom('*', ...desc.arg.values);
  return fc.record({
    phases: fc.array(atom, { minLength: 1, maxLength: 3 }),
    arg,
    target: desc.hasTarget ? target : fc.constant(undefined),
    modifiers: mods,
    held: gesture === 'hover' ? requirement : fc.constant(undefined),
  }).map(({ held, ...r }): ParsedRoute => {
    // An omitted slot parses to the descriptor's default, so a `*` arg on a gesture whose default is a value is
    // the slot spelled out, and parses back as `*`.
    return { ...r, gesture, ...(held ? { held } : {}) };
  });
});

/** `r` written with whitespace wherever the grammar allows it, and none of the canonical spacing. */
function messy(r: ParsedRoute, spaces: readonly string[]): string {
  let i = 0;
  const w = (): string => spaces[i++ % spaces.length]!;
  const desc = getGestureDescriptor(r.gesture);
  let out = `${w()}[${w()}${r.phases.map(formatPhaseAtom).join(`${w()},${w()}`)}${w()}]${w()}${r.gesture}${w()}`;
  if (desc.arg && r.arg !== undefined) out += `(${r.arg})`;
  if (desc.hasTarget && r.target !== undefined) out += `${w()}=>${w()}${r.target}`;
  for (const name of VALID_MOD_NAMES) {
    const req = r.modifiers[name];
    if (req) out += `${w()}${req === 'required' ? '+' : '?'}${name}`;
  }
  if (r.held) out += `${w()}${r.held === 'required' ? '+' : '?'}held`;
  return out + w();
}

describe('formatRoute and parseRoute', () => {
  it('a parsed route formats to a string that parses back to it', () => {
    fc.assert(fc.property(route, (r) => {
      expect(parseRoute(formatRoute(r))).toEqual(r);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('whitespace between the slots changes nothing', () => {
    const spaces = fc.array(fc.constantFrom('', ' ', '  ', '\t', ' \n '), { minLength: 1, maxLength: 20 });
    fc.assert(fc.property(route, spaces, (r, ws) => {
      expect(parseRoute(messy(r, ws))).toEqual(r);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  it('any string that parses is a fixpoint of format-then-parse, and junk throws an Error', () => {
    const piece = fc.constantFrom(
      '[', ']', '[initial]', '[*:*]', '[rect:engaged,*]', ',', ':', '&', '*', ' ', 'click', 'keyDown', 'hover', 'wheel',
      'multiTouch', 'drop', '(', ')', '(a)', '(up)', '(2)', '=>', ' => ', 'empty', 'kind:x', '+shift', '?mod', '+held',
      '?alt', '+meta', '!', '@', 'held', 'x', '|',
    );
    let parsed = 0;
    fc.assert(fc.property(fc.array(piece, { maxLength: 9 }), (pieces) => {
      const s = pieces.join('');
      let r: ParsedRoute;
      try {
        r = parseRoute(s);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        return;
      }
      parsed++;
      expect(parseRoute(formatRoute(r))).toEqual(r);
    }), runs(RUNS * 4));
    expect(parsed).toBeGreaterThan(0);
  }, timeoutFor(RUNS * 4, 1));
});

describe('key routes', () => {
  const key = fc.oneof(fc.constant('?'), charsOf('aZ1 )(+=*я', 4).filter((s) => !s.includes('?')));
  const optional = fc.shuffledSubarray([...VALID_MOD_NAMES] as OptionalMod[]);

  it('parse back from their canonical form', () => {
    fc.assert(fc.property(key, optional, (k, optionalMods) => {
      const r = { key: k, optionalMods };
      expect(parseKeyRoute(formatKeyRoute(r))).toEqual(r);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

/** The shift states a route accepts, under a name for everything else about it. */
function shiftStates(routes: readonly string[]): Map<string, Set<boolean>> {
  const out = new Map<string, Set<boolean>>();
  for (const raw of routes) {
    const r = parseRoute(raw);
    const { shift, ...rest } = r.modifiers;
    const name = formatRoute({ ...r, modifiers: rest });
    const states = out.get(name) ?? new Set<boolean>();
    if (shift !== 'required') states.add(false);
    if (shift !== undefined) states.add(true);
    out.set(name, states);
  }
  return out;
}

describe('collapseShiftPairs', () => {
  it('accepts exactly the shift states its input did, in no more routes', () => {
    const base = fc.constantFrom('[initial] keyDown(a)', '[initial] keyDown(a) +mod', '[*] click => empty', '[engaged] keyDown(b) ?alt');
    const shift = fc.constantFrom('', ' +shift', ' ?shift');
    let folded = 0;
    fc.assert(fc.property(fc.array(fc.tuple(base, shift), { maxLength: 8 }), (pairs) => {
      const input = pairs.map(([b, s]) => formatRoute(parseRoute(b + s)));
      const output = collapseShiftPairs(input);
      expect(output.length).toBeLessThanOrEqual(input.length);
      if (output.length < input.length) folded++;
      expect(shiftStates(output)).toEqual(shiftStates(input));
    }), runs(RUNS));
    expect(folded).toBeGreaterThan(0);
  }, timeoutFor(RUNS, 2));
});
