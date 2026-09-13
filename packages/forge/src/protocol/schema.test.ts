import { f, resolveConfigSchema } from '@weasel-js/labkit/config';
import { describe, expect, it } from 'vitest';
import { answerSchema, describeSchema, schemaFromDescription } from './schema';

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

  it('answers validate in the frame and serves it to the rebuilt leaf', () => {
    const schema = f.schema({
      blob: f.custom('json', { a: 1 }, (leaf) => (leaf.kind === 'json' ? ['bad blob'] : [])),
    });
    const { errors } = answerSchema(schema, schema.defaults());
    expect(errors).toEqual({ blob: ['bad blob'] });

    const d = describeSchema(schema);
    expect(d.nodes.blob).toMatchObject({ validated: true });
    const rebuilt = schemaFromDescription(d, {
      hidden: () => false,
      errors: (path) => errors[path] ?? [],
    });
    const leaf = rebuilt.nodes.blob;
    const validate = 'children' in leaf ? undefined : leaf.options.validate;
    expect(validate?.({ kind: 'json', name: 'Blob', description: '', default: {} } as never)).toEqual([
      'bad blob',
    ]);
  });
});
