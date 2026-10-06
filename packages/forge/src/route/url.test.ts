import { f } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { argsToSchema } from '../csf/argsToSchema';
import {
  decodeKnob,
  formatRoute,
  knobParams,
  knobsToParams,
  paramsToKnobs,
  parseRoute,
  reservedParams,
  storyHref,
} from './url';

const schema = f.schema({
  label: f.string('Save'),
  size: f.number(12),
  dark: f.boolean(false),
  tone: f.enum('neutral', ['neutral', 'accent']),
  ink: f.color('#000000'),
  tags: f.list(['a']),
  free: f.value(3),
  look: f.group({ px: f.number(4), round: f.boolean(true), inner: f.group({ name: f.string('x') }) }),
});

describe('parseRoute / formatRoute', () => {
  it('reads the story and its params from one hash', () => {
    expect(parseRoute('#/kit-button--primary?label=Go&look.px=8')).toEqual({
      story: 'kit-button--primary',
      params: { label: 'Go', 'look.px': '8' },
    });
  });

  it('names no story for a hash in any other form', () => {
    expect(parseRoute('#kit-button')).toEqual({ story: null, params: {} });
    expect(parseRoute('')).toEqual({ story: null, params: {} });
    expect(parseRoute('#/?a=1').story).toBeNull();
  });

  it('survives a malformed escape in the story id', () => {
    expect(parseRoute('#/%E0%A4%A').story).toBeNull();
  });

  it('round-trips ids and values that need escaping', () => {
    const route = { story: 'a b/c?d', params: { label: 'x & y=z', 'look.px': '4', t: '1.5' } };
    expect(parseRoute(formatRoute(route))).toEqual(route);
  });

  it('formats a bare hash when there are no params', () => {
    expect(formatRoute({ story: 'a', params: {} })).toBe('#/a');
  });
});

describe('reserved params', () => {
  it('keeps t out of the knobs and in the reserved set', () => {
    const params = { t: '2', label: 'Go', $globals: 'x' };
    expect(knobParams(params)).toEqual({ label: 'Go' });
    expect(reservedParams(params)).toEqual({ t: '2', $globals: 'x' });
  });

  it('never reads t as a knob, even when the story has an arg named t', () => {
    expect(paramsToKnobs(f.schema({ t: f.number(0) }), { t: '5' })).toEqual({});
  });
});

describe('decodeKnob', () => {
  const leaf = (kind: string | null, def: unknown, options?: string[]) => ({
    kind,
    default: def,
    ...(options ? { annotations: { options: options.map((value) => ({ value })) } } : {}),
  });

  it('reads numbers, refusing what is not one', () => {
    expect(decodeKnob('8', leaf('number', 0))).toEqual({ value: 8 });
    expect(decodeKnob('-1.5', leaf('number', 0))).toEqual({ value: -1.5 });
    expect(decodeKnob('Infinity', leaf('number', 0))).toEqual({ value: Infinity });
    expect(decodeKnob('wide', leaf('number', 0))).toBeUndefined();
    expect(decodeKnob('', leaf('number', 0))).toBeUndefined();
  });

  it('reads booleans, with a bare param as true', () => {
    expect(decodeKnob('true', leaf('boolean', false))).toEqual({ value: true });
    expect(decodeKnob('0', leaf('boolean', true))).toEqual({ value: false });
    expect(decodeKnob('', leaf('boolean', false))).toEqual({ value: true });
    expect(decodeKnob('yes', leaf('boolean', false))).toBeUndefined();
  });

  it('accepts only an enum option the leaf lists', () => {
    expect(decodeKnob('accent', leaf('enum', 'neutral', ['neutral', 'accent']))).toEqual({ value: 'accent' });
    expect(decodeKnob('loud', leaf('enum', 'neutral', ['neutral', 'accent']))).toBeUndefined();
  });

  it('reads a list and a json leaf as JSON of the default shape', () => {
    expect(decodeKnob('["x","y"]', leaf('list', []))).toEqual({ value: ['x', 'y'] });
    expect(decodeKnob('[1]', leaf('list', []))).toBeUndefined();
    expect(decodeKnob('{"a":1}', leaf('json', { a: 0 }))).toEqual({ value: { a: 1 } });
    expect(decodeKnob('[1]', leaf('json', { a: 0 }))).toBeUndefined();
    expect(decodeKnob('{oops', leaf('json', {}))).toBeUndefined();
  });

  it('falls back to the type of the default for a leaf with no declared kind, or a custom one', () => {
    expect(decodeKnob('7', leaf(null, 3))).toEqual({ value: 7 });
    expect(decodeKnob('false', leaf('my-toggle', true))).toEqual({ value: false });
    expect(decodeKnob('anything', leaf('my-thing', undefined))).toBeUndefined();
  });
});

describe('knobsToParams', () => {
  it('writes only the leaves that differ from their defaults, grouped ones by dotted path', () => {
    const config = {
      ...schema.defaults(),
      size: 20,
      tone: 'accent',
      tags: ['a', 'b'],
      look: { px: 4, round: false, inner: { name: 'y' } },
    };
    expect(knobsToParams(schema, config)).toEqual({
      size: '20',
      tone: 'accent',
      tags: '["a","b"]',
      'look.round': 'false',
      'look.inner.name': 'y',
    });
  });

  it('writes nothing for a config at its defaults, or one missing keys', () => {
    expect(knobsToParams(schema, schema.defaults())).toEqual({});
    expect(knobsToParams(schema, {})).toEqual({});
  });

  it('leaves out forge’s own $globals pins', () => {
    const withGlobals = f.schema({ size: f.number(1), $globals: f.group({ mode: f.string('lab') }) });
    expect(knobsToParams(withGlobals, { size: 1, $globals: { mode: 'dark' } })).toEqual({});
  });
});

describe('paramsToKnobs', () => {
  it('coerces each param by its leaf and skips what does not parse or names no leaf', () => {
    expect(
      paramsToKnobs(schema, {
        size: '20',
        dark: 'true',
        tone: 'loud',
        'look.px': '9',
        'look.inner.name': 'z',
        free: 'nope',
        missing: '1',
        t: '3',
      }),
    ).toEqual({ size: 20, dark: true, 'look.px': 9, 'look.inner.name': 'z' });
  });

  it('round-trips with knobsToParams', () => {
    const config = { ...schema.defaults(), label: 'a=b&c', ink: '#ff0000', look: { px: 0, round: true, inner: { name: 'x' } } };
    const knobs = paramsToKnobs(schema, knobsToParams(schema, config));
    expect(knobs).toEqual({ label: 'a=b&c', ink: '#ff0000', 'look.px': 0 });
  });

  it('reads a CSF story’s args by their control types', () => {
    const csf = argsToSchema(
      { variant: 'primary', count: 1, open: false },
      { variant: { control: 'select', options: ['primary', 'ghost'] }, count: { control: { type: 'range', min: 0, max: 5 } } },
    );
    expect(paramsToKnobs(csf, { variant: 'ghost', count: '3', open: '1' })).toEqual({ variant: 'ghost', count: 3, open: true });
    expect(paramsToKnobs(csf, { variant: 'loud' })).toEqual({});
  });
});

describe('storyHref', () => {
  it('builds a link from values, keeping reserved params and refusing reserved knob names', () => {
    expect(storyHref('kit-button--primary', { label: 'Go', 'look.px': 8, t: 1 }, { t: '2.5' })).toBe(
      '#/kit-button--primary?label=Go&look.px=8&t=2.5',
    );
  });

  it('is read back by paramsToKnobs', () => {
    const href = storyHref('s', { size: 20, dark: true, tags: ['q'] });
    expect(paramsToKnobs(schema, parseRoute(href).params)).toEqual({ size: 20, dark: true, tags: ['q'] });
  });
});
