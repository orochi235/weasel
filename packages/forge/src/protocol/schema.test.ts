import { f, resolveConfigSchema } from '@weasel-js/labkit/config';
import { describe, expect, it, vi } from 'vitest';
import { answerSchema, describeSchema, schemaActionAt, schemaFromDescription } from './schema';

const original = f.schema({
  size: f.number(12).range(8, 48).step(1).slider().label('Size'),
  weight: f.enum('regular', ['light', 'regular', 'bold']).radio(),
  grid: f
    .group({
      on: f.boolean(true),
      spacing: f.number(10).showIf((c) => (c.grid as { on: boolean }).on),
    })
    .section('Grid'),
});

const noAnswers = { hidden: () => false, errors: () => [] };

describe('schema descriptions', () => {
  it('survive structured cloning', () => {
    const description = describeSchema(original);
    expect(structuredClone(description)).toEqual(description);
  });

  it('rebuild to the same defaults and controls', () => {
    const rebuilt = schemaFromDescription(structuredClone(describeSchema(original)), noAnswers);
    expect(rebuilt.defaults()).toEqual(original.defaults());
    expect(resolveConfigSchema(rebuilt, []).group).toEqual(resolveConfigSchema(original, []).group);
    expect(resolveConfigSchema(rebuilt, []).sections).toEqual(
      resolveConfigSchema(original, []).sections,
    );
  });

  it('answers showIf in the frame and applies the answer in the workshop', () => {
    const off = { ...original.defaults(), grid: { on: false, spacing: 10 } };
    const { hidden } = answerSchema(original, off);
    expect(hidden).toEqual(['grid.spacing']);
    const rebuilt = schemaFromDescription(describeSchema(original), {
      hidden: (path) => hidden.includes(path),
      errors: () => [],
    });
    const resolved = resolveConfigSchema(rebuilt, []);
    expect(resolved.showIf.get('grid.spacing')?.(off as never)).toBe(false);
  });

  it('answers a showIf written as data too, and ships the condition itself', () => {
    const schema = f.schema({
      on: f.boolean(false),
      spacing: f.number(10).showIf({ path: 'on' }),
      more: f.group({ deep: f.number(1) }).showIf({ path: 'on' }),
    });
    expect(answerSchema(schema, { on: false }).hidden).toEqual(['spacing', 'more']);
    expect(answerSchema(schema, { on: true }).hidden).toEqual([]);
    const described = describeSchema(schema);
    expect(described.nodes.spacing).toMatchObject({ conditional: false, annotations: { showIf: { path: 'on' } } });
    expect(structuredClone(described)).toEqual(described);
  });

  it('marks a custom control without shipping it', () => {
    const custom = f.schema({ blob: f.custom('json', { a: 1 }) });
    const d = describeSchema(custom);
    expect(d.nodes.blob).toMatchObject({ branch: false, kind: 'json', default: { a: 1 } });
  });

  it('flags a node-level render and ships no function', () => {
    const d = describeSchema(f.schema({ size: f.number(1).render(() => null) }));
    expect(d.nodes.size).toMatchObject({ customControl: true });
    expect(structuredClone(d)).toEqual(d);
  });

  it('ships no function an annotation holds, and runs an action in the frame through the answers', () => {
    const run = vi.fn();
    const schema = f.schema({
      go: f.action(run),
      gain: f.number(1).scale({ to: Math.log, from: Math.exp }).unit({ suffix: 'dB', toDisplay: (v) => v, fromDisplay: (v) => v }),
      pos: f.object({ x: f.number(0) }).summary((v) => String(v.x)),
      list: f.list([{ x: 0 }], f.object({ x: f.number(0) }).summary((v) => String(v.x))),
    });
    const d = describeSchema(schema);
    expect(() => structuredClone(d)).not.toThrow();
    expect(d.nodes.go).toMatchObject({ kind: 'action', runsInFrame: true });
    expect(d.nodes.gain).toMatchObject({ kind: 'number', annotations: {} });
    expect(d.nodes.gain).not.toHaveProperty('annotations.scale');
    expect(d.nodes.list).toMatchObject({ annotations: { item: { kind: 'object', children: { x: { kind: 'number' } } } } });

    const asked = vi.fn();
    const rebuilt = schemaFromDescription(structuredClone(d), { ...noAnswers, run: asked });
    const go = rebuilt.nodes.go;
    const ctx = { path: 'go', config: {}, setConfig: () => {} };
    if (!('children' in go)) (go.annotations.run as (c: typeof ctx) => void)(ctx);
    expect(asked).toHaveBeenCalledWith('go', ctx);
    expect(schemaActionAt(schema, 'go')).toBe(run);
    expect(schemaActionAt(schema, 'gain')).toBeUndefined();
  });

  it('answers validate in the frame and serves it to the rebuilt leaf', () => {
    const schema = f.schema({
      blob: f.custom('json', { a: 1 }, (leaf, config) =>
        leaf.kind === 'json' && (config.blob as { a: number }).a > 1 ? ['bad blob'] : [],
      ),
    });
    expect(answerSchema(schema, schema.defaults()).errors).toEqual({});
    const config = { blob: { a: 2 } };
    const { errors } = answerSchema(schema, config);
    expect(errors).toEqual({ blob: ['bad blob'] });

    const d = describeSchema(schema);
    expect(d.nodes.blob).toMatchObject({ validated: true });
    const rebuilt = schemaFromDescription(d, {
      hidden: () => false,
      errors: (path, c) => (c === config ? (errors[path] ?? []) : []),
    });
    const leaf = rebuilt.nodes.blob;
    const validate = 'children' in leaf ? undefined : leaf.options.validate;
    expect(validate?.({ kind: 'json', name: 'Blob', description: '', default: {} } as never, config)).toEqual([
      'bad blob',
    ]);
  });
});
