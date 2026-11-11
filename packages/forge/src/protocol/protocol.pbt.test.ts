/**
 * The frame protocol: a schema described for the port is data a structured clone copies whole, rebuilds to a schema
 * that describes the same, and answers the same visibility and errors once served the frame's answers; a channel
 * delivers what the other end sent and turns away anything that is not an envelope of its version.
 */
import { type ConfigEntry, type ConfigSchema, f } from '@weasel-js/labkit/config';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { anyFinite, json, key, runs, tally, text, timeoutFor } from '../pbt.fixture';
import { type Mismatch, openChannel, type PortLike } from './channel';
import { PROTOCOL_VERSION } from './messages';
import { answerSchema, describeSchema, schemaFromDescription } from './schema';

const RUNS = 200;

function setOwn(target: Record<string, unknown>, k: string, value: unknown): void {
  Object.defineProperty(target, k, { value, enumerable: true, writable: true, configurable: true });
}

/** A predicate on a config that reads it as data, so the original and the rebuilt schema can be asked alike. */
const predicate = fc.integer({ min: 0, max: 3 }).map((salt) => (config: Record<string, unknown>) => (JSON.stringify(config).length + salt) % 3 !== 0);

type Decorate = (node: ConfigEntry) => ConfigEntry;
const decorate: fc.Arbitrary<Decorate> = fc.oneof(
  fc.constant<Decorate>((n) => n),
  predicate.map((p): Decorate => (n) => (n as unknown as { showIf(p: unknown): ConfigEntry }).showIf(p)),
  fc.constantFrom('Look', 'More').map((label): Decorate => (n) => (n as unknown as { section(l: string): ConfigEntry }).section(label)),
);

const leaf: fc.Arbitrary<ConfigEntry> = fc.oneof(
  text.map((d) => f.string(d) as ConfigEntry),
  anyFinite.map((d) => f.number(d) as ConfigEntry),
  fc.boolean().map((d) => f.boolean(d) as ConfigEntry),
  fc.uniqueArray(text, { minLength: 1, maxLength: 3 }).map((o) => f.enum(o[0]!, o) as ConfigEntry),
  fc.tuple(json, fc.integer({ min: 0, max: 2 })).map(([d, salt]) =>
    f.custom('json', d, (_leaf, config) => (JSON.stringify(config).length % 3 === salt ? [`bad ${salt}`] : [])) as ConfigEntry,
  ),
);

const shape: fc.Arbitrary<Record<string, ConfigEntry>> = fc.letrec<{ shape: Record<string, ConfigEntry> }>((tie) => ({
  shape: fc
    .uniqueArray(
      fc.tuple(key, fc.oneof({ weight: 3, arbitrary: leaf }, { weight: 1, arbitrary: tie('shape').map((s) => f.group(s) as unknown as ConfigEntry) }), decorate),
      { selector: ([k]) => k, maxLength: 4, depthIdentifier: 'shape' },
    )
    .map((rows) => {
      const out: Record<string, ConfigEntry> = {};
      for (const [k, entry, dec] of rows) setOwn(out, k, dec(entry));
      return out;
    }),
})).shape;

const schema = shape.map((s) => f.schema(s) as unknown as ConfigSchema<unknown>);

/** A config: the schema's defaults with some values changed, so predicates answer both ways. */
const configFor = (s: ConfigSchema<unknown>): fc.Arbitrary<unknown> =>
  fc.array(fc.tuple(key, json), { maxLength: 3 }).map((extra) => {
    const out = structuredClone(s.defaults()) as Record<string, unknown>;
    for (const [k, v] of extra) setOwn(out, k, v);
    return out;
  });

describe('schema descriptions', () => {
  it('clone whole, rebuild to the same description, and answer as the original once served its answers', () => {
    const seen = tally();
    fc.assert(
      fc.property(schema.chain((s) => fc.tuple(fc.constant(s), fc.array(configFor(s), { minLength: 1, maxLength: 3 }))), ([original, configs]) => {
        const description = describeSchema(original);
        expect(structuredClone(description)).toEqual(description);
        const answered = new Map(configs.map((c) => [c, answerSchema(original, c)]));
        const rebuilt = schemaFromDescription(structuredClone(description), {
          hidden: (path, config) => answered.get(config)?.hidden.includes(path) ?? false,
          errors: (path, config) => {
            const errors = answered.get(config)?.errors;
            return errors && Object.hasOwn(errors, path) ? errors[path]! : [];
          },
        });
        expect(describeSchema(rebuilt)).toEqual(description);
        expect(Object.keys(rebuilt.nodes)).toEqual(Object.keys(original.nodes));
        for (const config of configs) {
          const want = answered.get(config)!;
          expect(answerSchema(rebuilt, config)).toEqual(want);
          if (want.hidden.length > 0) seen.count('hidden');
          if (Object.keys(want.errors).length > 0) seen.count('errors');
          if (Object.keys(original.nodes).some((k) => /__proto__|constructor|toString/.test(k))) seen.count('prototype-named');
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('hidden', 30);
    seen.atLeast('errors', 30);
    seen.atLeast('prototype-named', 30);
  }, timeoutFor(RUNS, 5));
});

/** Two ports joined, each delivering what the other posts, as a `MessageChannel` does but at once. */
function portPair(): [PortLike & { deliver(data: unknown): void }, PortLike & { deliver(data: unknown): void }] {
  const make = () => {
    const listeners = new Set<(event: MessageEvent) => void>();
    const port = {
      peer: null as null | { deliver(data: unknown): void },
      closed: false,
      postMessage(message: unknown) {
        port.peer?.deliver(structuredClone(message));
      },
      addEventListener: (_type: 'message', fn: (event: MessageEvent) => void) => void listeners.add(fn),
      removeEventListener: (_type: 'message', fn: (event: MessageEvent) => void) => void listeners.delete(fn),
      close() {
        port.closed = true;
      },
      deliver(data: unknown) {
        for (const fn of [...listeners]) fn({ data } as MessageEvent);
      },
    };
    return port;
  };
  const a = make();
  const b = make();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

describe('channel', () => {
  it('delivers each message sent, in order, and refuses anything not an envelope of its version', () => {
    const seen = tally();
    const message = fc.record({ type: fc.constantFrom('config', 'state', 'scroll'), value: json });
    const junk = fc.oneof(
      json.filter((v) => v === null || typeof v !== 'object' || !Object.hasOwn(v, 'msg')),
      fc.record({ v: fc.oneof(fc.integer(), fc.constant(undefined), text), msg: json }).filter((e) => e.v !== PROTOCOL_VERSION),
    );
    const step = fc.oneof(message.map((m) => ({ send: m })), junk.map((j) => ({ junk: j })));
    fc.assert(
      fc.property(fc.array(step, { maxLength: 8 }), (steps) => {
        const [a, b] = portPair();
        const mismatches: Mismatch[] = [];
        const from = openChannel<never, unknown>(a);
        const to = openChannel<unknown, never>(b, { onMismatch: (m) => mismatches.push(m) });
        const got: unknown[] = [];
        to.on((m) => got.push(m));
        const sent: unknown[] = [];
        const refused: Mismatch['reason'][] = [];
        for (const s of steps) {
          if ('send' in s) {
            from.send(s.send);
            sent.push(s.send);
          } else {
            b.deliver(s.junk);
            const j = s.junk as { v?: unknown } | null;
            refused.push(j !== null && typeof j === 'object' && Object.hasOwn(j, 'msg') ? 'version' : 'not-an-envelope');
            seen.count('junk');
          }
        }
        expect(got).toEqual(sent);
        expect(mismatches.map((m) => m.reason)).toEqual(refused);
        to.close();
        b.deliver({ v: PROTOCOL_VERSION, msg: 'late' });
        expect(got).toEqual(sent);
      }),
      runs(RUNS),
    );
    seen.atLeast('junk', 100);
  }, timeoutFor(RUNS, 1));
});

describe('shrunk counterexamples', () => {
  it('describes and rebuilds a group keyed `__proto__` as an own entry', () => {
    const shape: Record<string, ConfigEntry> = {};
    setOwn(shape, '__proto__', f.group({}).section('Look'));
    const description = describeSchema(f.schema(shape) as unknown as ConfigSchema<unknown>);
    expect(Object.keys(description.nodes)).toEqual(['__proto__']);
    const rebuilt = schemaFromDescription(description, { hidden: () => false, errors: () => [] });
    expect(Object.keys(rebuilt.nodes)).toEqual(['__proto__']);
  });

  it('reports errors on a leaf keyed `__proto__` as an own key', () => {
    const shape: Record<string, ConfigEntry> = {};
    setOwn(shape, '__proto__', f.custom('json', 1, () => ['bad']) as ConfigEntry);
    const { errors } = answerSchema(f.schema(shape) as unknown as ConfigSchema<unknown>, {});
    expect(Object.hasOwn(errors, '__proto__') && errors['__proto__']).toEqual(['bad']);
  });
});
