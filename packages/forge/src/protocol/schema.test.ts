import { f, resolveAutoConfig, resolveConfigSchema } from '@weasel-js/labkit/config';
import { createAnswerBook } from '../shell/answers';
import { stableStringify } from './messages';
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

  it('answers an enableIf written as code in the frame, and carries a group reset', () => {
    const schema = f.schema({
      on: f.boolean(false),
      size: f.number(1).enableIf((c) => c.on === true),
      look: f.group({ px: f.number(4) }).resettable(),
    });
    const off = { on: false, size: 1, look: { px: 4 } };
    const { disabled } = answerSchema(schema, off);
    expect(disabled).toEqual(['size']);
    expect(answerSchema(schema, { ...off, on: true }).disabled).toEqual([]);
    const rebuilt = schemaFromDescription(structuredClone(describeSchema(schema)), {
      ...noAnswers,
      disabled: (path) => disabled.includes(path),
    });
    const resolved = resolveConfigSchema(rebuilt, []);
    expect(resolved.enableIf?.get('size')?.(off)).toBe(false);
    expect(resolved.group.children.look).toMatchObject({ resettable: true });
  });

  it('carries an auto leaf, quoting it, and answers its autoResolve in the frame', () => {
    const schema = f.schema({
      size: f.number(10),
      gap: f.number(2).auto((c) => (c.size as number) / 5).quote(),
      pad: f.number(1).auto(),
    });
    const config = { size: 20, gap: 2, pad: 1 };
    const { resolved } = answerSchema(schema, config);
    expect(resolved).toEqual({ gap: 4 });
    const rebuilt = schemaFromDescription(structuredClone(describeSchema(schema)), {
      ...noAnswers,
      resolved: (path) => resolved[path],
    });
    const nodes = rebuilt.nodes as Record<string, { options: Record<string, unknown> }>;
    const own = schema.nodes as Record<string, { options: Record<string, unknown> }>;
    const gap = nodes.gap!.options;
    expect(gap.auto).toEqual(own.gap!.options.auto);
    expect(gap.autoQuote).toBe(true);
    expect((gap.autoResolve as (c: unknown) => unknown)(config)).toBe(4);
    expect(nodes.pad!.options.auto).toEqual(own.pad!.options.auto);
    expect(own.pad!.options.auto).toBeDefined();
    expect(nodes.pad!.options.autoResolve).toBeUndefined();
  });

  it("resolves an auto leaf in the workshop from the frame's answer for the config it was handed", () => {
    const schema = f.schema({ size: f.number(10), gap: f.number(2).auto((c) => (c.size as number) / 5) });
    const book = createAnswerBook();
    const rebuilt = resolveConfigSchema(schemaFromDescription(structuredClone(describeSchema(schema)), book), []);
    const auto = new Set(['gap']);
    // The trial's instrument reads the stored config with each auto path resolved; the frame answers what it gets.
    let sent = resolveAutoConfig(rebuilt, { size: 20, gap: 2 }, auto);
    for (let i = 0; i < 3; i++) {
      book.record({ configKey: stableStringify(sent), ...answerSchema(schema, sent) });
      sent = resolveAutoConfig(rebuilt, { size: 20, gap: 2 }, auto);
    }
    expect(sent).toEqual({ size: 20, gap: 4 });
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

  it('ships only the part of a default or an annotation a port delivers', () => {
    class Point {
      constructor(readonly x: number) {}
      norm() {
        return Math.abs(this.x);
      }
    }
    const schema = f.schema({
      motif: f.custom('motif', { name: 'dots', draw: () => null }),
      at: f.custom('point', new Point(1)),
      plain: f.custom('json', { n: 1 }).describe('plain'),
    });
    const withPoint = f.schema({ n: f.number(1) });
    (withPoint.nodes.n as { annotations: Record<string, unknown> }).annotations.origin = new Point(0);
    const description = describeSchema(schema);
    expect(() => structuredClone(description)).not.toThrow();
    const nodes = description.nodes as Record<string, { default?: unknown }>;
    expect(nodes.motif!.default).toEqual({ name: 'dots' });
    expect(nodes.at!.default).toBeUndefined();
    expect(nodes.plain!.default).toEqual({ n: 1 });
    const n = describeSchema(withPoint).nodes.n as unknown as { annotations: Record<string, unknown> };
    expect(Object.hasOwn(n.annotations, 'origin')).toBe(false);
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

  it('answers a key holding a dot apart from the nested path it reads like', () => {
    const run = vi.fn();
    const schema = f.schema({
      'a.b': f.custom('json', 1, () => ['flat']).showIf(() => false),
      a: f.group({ b: f.custom('json', 2, () => ['nested']) }),
      'go.now': f.action(run),
    });
    const { hidden, errors } = answerSchema(schema, schema.defaults());
    expect(hidden).toHaveLength(1);
    const asked: string[] = [];
    const rebuilt = schemaFromDescription(describeSchema(schema), {
      hidden: (path) => hidden.includes(path),
      errors: (path) => errors[path] ?? [],
      run: (path) => asked.push(path),
    });
    const flat = rebuilt.nodes['a.b']!;
    const nested = rebuilt.nodes.a!;
    if ('children' in flat || !('children' in nested)) throw new Error('unexpected shape');
    expect(flat.options.showIf?.({})).toBe(false);
    expect(nested.children.b!.options.showIf).toBeUndefined();
    expect(flat.options.validate?.(flat as never, {})).toEqual(['flat']);
    expect((nested.children.b as typeof flat).options.validate?.(flat as never, {})).toEqual(['nested']);
    const go = rebuilt.nodes['go.now']!;
    if (!('children' in go)) (go.annotations.run as (c: unknown) => void)({});
    expect(schemaActionAt(schema, asked[0]!)).toBe(run);
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
