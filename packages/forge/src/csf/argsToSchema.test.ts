import type { ConfigNode } from '@weasel-js/labkit/config';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { argsToSchema } from './argsToSchema';

const leaf = (args: Record<string, unknown>, argTypes: Parameters<typeof argsToSchema>[1], key: string) =>
  argsToSchema(args, argTypes).nodes[key] as ConfigNode<unknown> | undefined;

const shape = (node: ConfigNode<unknown> | undefined) =>
  node && { kind: node.kind, default: node.default, ...node.annotations };

const options = (...values: string[]) => values.map((value) => ({ value, label: value }));

describe('argsToSchema', () => {
  describe('without argTypes', () => {
    it('infers a leaf from the default value', () => {
      const schema = argsToSchema({ count: 3, on: true, label: 'hi', keys: [{ label: 'K' }], box: { w: 1 } }, {});
      expect(Object.fromEntries(Object.entries(schema.nodes).map(([k, n]) => [k, shape(n as ConfigNode<unknown>)])))
        .toEqual({
          count: { kind: 'number', default: 3 },
          on: { kind: 'boolean', default: true },
          label: { kind: 'string', default: 'hi' },
          keys: { kind: 'json', default: [{ label: 'K' }] },
          box: { kind: 'json', default: { w: 1 } },
        });
    });

    it('omits function and element args', () => {
      const schema = argsToSchema({ onClick: () => {}, icon: createElement('span'), n: 1 }, {});
      expect(Object.keys(schema.nodes)).toEqual(['n']);
    });

    it('omits object and array args that hold a function, which cannot cross the port', () => {
      const schema = argsToSchema({ job: { done: 1, cancel: () => {} }, instruments: [{ defaults: () => ({}) }], n: 1 }, {});
      expect(Object.keys(schema.nodes)).toEqual(['n']);
    });

    it('keeps defaults exactly', () => {
      expect(argsToSchema({ step: 0.001, name: '' }, {}).defaults()).toEqual({ step: 0.001, name: '' });
    });
  });

  it("maps 'inline-radio' to a radio enum", () => {
    expect(shape(leaf({ variant: 'minimal' }, { variant: { control: 'inline-radio', options: ['default', 'minimal'] } }, 'variant')))
      .toEqual({ kind: 'enum', default: 'minimal', options: options('default', 'minimal'), control: 'radio' });
  });

  it("maps 'radio' to a radio enum", () => {
    expect(leaf({ size: 'sm' }, { size: { control: 'radio', options: ['sm', 'md'] } }, 'size')?.annotations.control).toBe('radio');
  });

  it("maps 'select' to an enum", () => {
    expect(shape(leaf({ font: 'serif' }, { font: { control: 'select', options: ['sans', 'serif'] } }, 'font')))
      .toEqual({ kind: 'enum', default: 'serif', options: options('sans', 'serif') });
  });

  it('maps options with no control to an enum', () => {
    expect(shape(leaf({ mode: '2d' }, { mode: { options: ['1d', '2d'] } }, 'mode')))
      .toEqual({ kind: 'enum', default: '2d', options: options('1d', '2d') });
  });

  it("maps 'boolean' and 'switch'", () => {
    expect(shape(leaf({ on: true }, { on: { control: 'boolean' } }, 'on'))).toEqual({ kind: 'boolean', default: true });
    expect(shape(leaf({ on: false }, { on: { control: 'switch' } }, 'on')))
      .toEqual({ kind: 'boolean', default: false, control: 'switch' });
  });

  it("maps 'text' and 'textarea' to a string", () => {
    expect(shape(leaf({ a: 'x' }, { a: { control: 'text' } }, 'a'))).toEqual({ kind: 'string', default: 'x' });
    expect(shape(leaf({ a: 'x' }, { a: { control: 'textarea' } }, 'a'))).toEqual({ kind: 'string', default: 'x' });
  });

  it('maps a number control, bounded or not, to a typed input', () => {
    expect(shape(leaf({ min: 0 }, { min: { control: { type: 'number' } } }, 'min'))).toEqual({ kind: 'number', default: 0 });
    expect(shape(leaf({ k: 1.5 }, { k: { control: { type: 'number', step: 0.1 } } }, 'k')))
      .toEqual({ kind: 'number', default: 1.5, step: 0.1 });
    expect(shape(leaf({ w: 200 }, { w: { control: { type: 'number', min: 100, max: 800, step: 20 } } }, 'w')))
      .toEqual({ kind: 'number', default: 200, min: 100, max: 800, step: 20, control: 'input' });
  });

  it("maps 'range' and 'slider' to a slider", () => {
    expect(shape(leaf({ step: 0.01 }, { step: { control: { type: 'range', min: 0.001, max: 0.5, step: 0.001 } } }, 'step')))
      .toEqual({ kind: 'number', default: 0.01, min: 0.001, max: 0.5, step: 0.001, control: 'slider' });
    expect(shape(leaf({ t: 4 }, { t: { control: 'slider' } }, 't'))).toEqual({ kind: 'number', default: 4, control: 'slider' });
  });

  it("maps 'object' to a json leaf", () => {
    const keys = [{ label: '⌘' }, { label: 'K' }];
    expect(shape(leaf({ keys }, { keys: { control: 'object' } }, 'keys'))).toEqual({ kind: 'json', default: keys });
  });

  it('hides a leaf with control: false or a disabled table row', () => {
    expect(shape(leaf({ n: 2 }, { n: { control: false } }, 'n'))).toEqual({ kind: 'number', default: 2, hidden: true });
    expect(shape(leaf({ c: 'x' }, { c: { table: { disable: true } } }, 'c'))).toEqual({ kind: 'string', default: 'x', hidden: true });
  });

  it('carries name and description', () => {
    const argTypes = {
      thumbCount: { name: 'Thumb count', description: 'How many thumbs.', control: { type: 'range', min: 1, max: 8, step: 1 } },
    };
    expect(shape(leaf({ thumbCount: 3 }, argTypes, 'thumbCount'))).toEqual({
      kind: 'number',
      default: 3,
      min: 1,
      max: 8,
      step: 1,
      control: 'slider',
      name: 'Thumb count',
      description: 'How many thumbs.',
    });
  });

  describe('keeps an arg exactly, whatever the control kind', () => {
    it("keeps Powerline FlushNoGap's gap: 0 under a text control", () => {
      expect(shape(leaf({ gap: 0 }, { gap: { control: 'text' } }, 'gap'))).toEqual({ kind: 'string', default: 0 });
    });

    it("keeps Keycaps NoSeparator's separator: null under a text control", () => {
      expect(argsToSchema({ separator: null }, { separator: { control: 'text' } }).defaults()).toEqual({ separator: null });
    });

    it('keeps a mistyped arg under number, boolean and enum controls', () => {
      const schema = argsToSchema(
        { n: '4', on: 'yes', mode: 3 },
        { n: { control: { type: 'number' } }, on: { control: 'switch' }, mode: { control: 'select', options: ['a', 'b'] } },
      );
      expect(schema.defaults()).toEqual({ n: '4', on: 'yes', mode: 3 });
    });
  });

  describe('a control with no arg', () => {
    const only = (argType: Parameters<typeof argsToSchema>[1][string]) => argsToSchema({}, { k: argType });

    it.each([
      ['radio', { control: 'radio', options: ['a', 'b'] }, 'enum'],
      ['inline-radio', { control: 'inline-radio', options: ['a', 'b'] }, 'enum'],
      ['select', { control: 'select', options: ['a', 'b'] }, 'enum'],
      ['options alone', { options: ['a', 'b'] }, 'enum'],
      ['boolean', { control: 'boolean' }, 'boolean'],
      ['switch', { control: 'switch' }, 'boolean'],
      ['number', { control: { type: 'number' } }, 'number'],
      ['bounded number', { control: { type: 'number', min: 1, max: 50, step: 1 } }, 'number'],
      ['text', { control: 'text' }, 'string'],
      ['textarea', { control: 'textarea' }, 'string'],
    ] as const)('%s gets a leaf defaulting to undefined', (_, argType, kind) => {
      const schema = only(argType);
      expect((schema.nodes.k as ConfigNode<unknown> | undefined)?.kind).toBe(kind);
      expect(Object.hasOwn(schema.defaults() as object, 'k')).toBe(true);
      expect((schema.defaults() as Record<string, unknown>).k).toBeUndefined();
    });

    it.each([
      ['range', { control: { type: 'range', min: 0, max: 20, step: 0.5 } }],
      ['slider', { control: 'slider' }],
      ['object', { control: 'object' }],
    ] as const)('%s is omitted', (_, argType) => {
      expect(Object.keys(only(argType).nodes)).toEqual([]);
    });
  });

  describe('controls.matchers', () => {
    const matchers = { color: /(background|color)$/i, date: /Date$/i };
    const kinds = (args: Record<string, unknown>, argTypes: Parameters<typeof argsToSchema>[1] = {}) =>
      Object.fromEntries(
        Object.entries(argsToSchema(args, argTypes, matchers).nodes).map(([k, n]) => [k, (n as ConfigNode<unknown>).kind]),
      );

    it('makes a string arg whose name matches `color` a color leaf, keeping its default', () => {
      const schema = argsToSchema({ backgroundColor: '#ff0000', label: 'hi' }, {}, matchers);
      expect(shape(schema.nodes.backgroundColor as ConfigNode<unknown>)).toEqual({ kind: 'color', default: '#ff0000' });
      expect((schema.nodes.label as ConfigNode<unknown>).kind).toBe('string');
    });

    it('applies to an argType that names no control, and carries its annotations', () => {
      const schema = argsToSchema({ iconColor: 'red' }, { iconColor: { description: 'Ink' } }, matchers);
      expect(shape(schema.nodes.iconColor as ConfigNode<unknown>)).toEqual({ kind: 'color', default: 'red', description: 'Ink' });
    });

    it('leaves an arg whose argType names a control, or offers options, or is not a string', () => {
      expect(
        kinds(
          { textColor: 'red', fillColor: 'red', strokeColor: 3 },
          { textColor: { control: 'text' }, fillColor: { options: ['red', 'blue'] } },
        ),
      ).toEqual({ textColor: 'string', fillColor: 'enum', strokeColor: 'number' });
    });

    it('leaves a `date` match as a string, which has no date leaf in labkit', () => {
      expect(kinds({ startDate: '2026-01-01' })).toEqual({ startDate: 'string' });
    });
  });

  it('skips an argType with no arg and no control', () => {
    expect(Object.keys(argsToSchema({}, { onInput: { table: { disable: true } } }).nodes)).toEqual([]);
  });

  it('omits a function arg even when its argType names a control', () => {
    expect(Object.keys(argsToSchema({ onClick: () => {} }, { onClick: { control: false } }).nodes)).toEqual([]);
  });

  describe('conditional controls', () => {
    const args = { showGrid: false, gridDivisions: 3, mode: 'a' };
    const shownWhen = (argTypes: Parameters<typeof argsToSchema>[1], key: string, config: Record<string, unknown>) => {
      const node = argsToSchema(args, argTypes).nodes[key] as ConfigNode<unknown>;
      return node.options.showIf ? node.options.showIf(config) : true;
    };

    it('shows a control only while the arg its `if` names is truthy', () => {
      const argTypes = { gridDivisions: { control: 'number', if: { arg: 'showGrid' } } } as const;
      expect(shownWhen(argTypes, 'gridDivisions', { showGrid: false })).toBe(false);
      expect(shownWhen(argTypes, 'gridDivisions', { showGrid: true })).toBe(true);
    });

    it('honors truthy: false, exists, eq and neq', () => {
      const at = (condition: Record<string, unknown>, config: Record<string, unknown>) =>
        shownWhen({ gridDivisions: { control: 'number', if: { arg: 'mode', ...condition } } }, 'gridDivisions', config);
      expect(at({ truthy: false }, { mode: '' })).toBe(true);
      expect(at({ truthy: false }, { mode: 'a' })).toBe(false);
      expect(at({ exists: true }, { mode: 'a' })).toBe(true);
      expect(at({ exists: true }, {})).toBe(false);
      expect(at({ exists: false }, {})).toBe(true);
      expect(at({ eq: 'b' }, { mode: 'b' })).toBe(true);
      expect(at({ eq: 'b' }, { mode: 'a' })).toBe(false);
      expect(at({ neq: 'b' }, { mode: 'a' })).toBe(true);
      expect(at({ neq: 'b' }, { mode: 'b' })).toBe(false);
    });

    it('ignores a condition on a global, which a story’s config does not hold', () => {
      const node = argsToSchema(args, { gridDivisions: { control: 'number', if: { global: 'theme', eq: 'dark' } } }).nodes
        .gridDivisions as ConfigNode<unknown>;
      expect(node.options.showIf).toBeUndefined();
    });
  });
});
