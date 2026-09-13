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

  it("gives a controlled argType with no arg its control kind's zero value", () => {
    const schema = argsToSchema(
      {},
      {
        showStops: { control: 'boolean' },
        count: { control: { type: 'number' } },
        label: { control: 'text' },
        track: { control: 'inline-radio', options: ['none', 'move-nearest'] },
      },
    );
    expect(schema.defaults()).toEqual({ showStops: false, count: 0, label: '', track: 'none' });
  });

  it('skips an argType with no arg and no control', () => {
    expect(Object.keys(argsToSchema({}, { onInput: { table: { disable: true } } }).nodes)).toEqual([]);
  });

  it('omits a function arg even when its argType names a control', () => {
    expect(Object.keys(argsToSchema({ onClick: () => {} }, { onClick: { control: false } }).nodes)).toEqual([]);
  });
});
