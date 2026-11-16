/**
 * An `EffectDoc` read from a file or storage, checked on the way in: every field the editor and the looks read is
 * the type `types.ts` gives it, or the read refuses, naming the first one that is not.
 */
import type { EffectDoc } from './types';

type Raw = Record<string, unknown>;
type Check = (v: unknown, path: string) => void;

/** Why a value is not an {@link EffectDoc}: `path` names the field. */
export class EffectDocShapeError extends Error {
  constructor(readonly path: string, problem: string) {
    super(`Not an effect document: ${path} ${problem}`);
    this.name = 'EffectDocShapeError';
  }
}

const isRaw = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);

function fail(path: string, problem: string): never {
  throw new EffectDocShapeError(path, problem);
}

const object = (v: unknown, path: string): Raw => (isRaw(v) ? v : fail(path, 'is not an object'));
const string: Check = (v, path) => { if (typeof v !== 'string') fail(path, 'is not a string'); };
const number: Check = (v, path) => { if (typeof v !== 'number') fail(path, 'is not a number'); };
const boolean: Check = (v, path) => { if (typeof v !== 'boolean') fail(path, 'is not true or false'); };

const optional = (check: Check): Check => (v, path) => { if (v !== undefined) check(v, path); };
const listOf = (check: Check): Check => (v, path) => {
  if (!Array.isArray(v)) fail(path, 'is not a list');
  v.forEach((item, i) => check(item, `${path}[${i}]`));
};
const recordOf = (check: Check): Check => (v, path) => {
  for (const [key, item] of Object.entries(object(v, path))) check(item, `${path}.${key}`);
};
const fields = (shape: Readonly<Record<string, Check>>): Check => (v, path) => {
  const raw = object(v, path);
  for (const [key, check] of Object.entries(shape)) check(raw[key], `${path}.${key}`);
};

const vec2 = fields({ x: number, y: number });
const box = fields({ x: number, y: number, width: number, height: number });
const endpoint = fields({ stage: string, port: string });
const port = fields({ id: string, label: optional(string), type: string, many: optional(boolean) });

const control: Check = (v, path) => {
  const raw = object(v, path);
  switch (raw.kind) {
    case 'number':
      return fields({ value: number, min: optional(number), max: optional(number), step: optional(number), unit: optional(string) })(raw, path);
    case 'enum':
      return fields({ value: string, options: listOf(fields({ value: string, label: optional(string) })) })(raw, path);
    case 'boolean':
      return boolean(raw.value, `${path}.value`);
    case 'string':
      return string(raw.value, `${path}.value`);
    default:
      return fail(`${path}.kind`, 'is not number, enum, boolean or string');
  }
};

const stage = fields({
  id: string,
  title: string,
  kind: optional(string),
  type: optional(string),
  inputs: optional(listOf(port)),
  outputs: optional(listOf(port)),
  params: optional(listOf(fields({ id: optional(string), label: string, value: string, control: optional(control) }))),
  split: optional(fields({ input: string, at: listOf(number) })),
  bypassed: optional(boolean),
  data: optional(recordOf(() => {})),
});

const pipeline = fields({
  stages: listOf(stage),
  wires: listOf(fields({ id: optional(string), from: endpoint, to: endpoint, label: optional(string) })),
  groups: optional(listOf(fields({ id: string, label: optional(string), members: listOf(string) }))),
  types: optional(recordOf(fields({ control: optional(boolean) }))),
});

const labelAt: Check = (v, path) => {
  if (v === 'start' || v === 'mid' || v === 'end' || typeof v === 'number') return;
  fields({ near: vec2 })(v, path);
};

const lookRoute = fields({
  waypoints: listOf(vec2),
  ends: (v, path) => {
    listOf(vec2)(v, path);
    if ((v as unknown[]).length !== 2) fail(path, 'is not a pair of points');
  },
});

const doc = fields({
  pipeline,
  places: recordOf(vec2),
  pages: optional(listOf(fields({ id: string, name: optional(string), width: number, height: number, meta: optional(recordOf(() => {})) }))),
  laneOrder: optional(listOf(string)),
  routes: optional(recordOf(listOf(vec2))),
  lookRoutes: optional(fields({ rack: optional(recordOf(lookRoute)), lanes: optional(recordOf(lookRoute)) })),
  labels: optional(recordOf(fields({
    at: labelAt,
    offset: optional(number),
    inset: optional(number),
    placed: optional(fields({ at: number, offset: number })),
    dodge: optional((v, path) => { if (v !== false) fail(path, 'is not false'); }),
  }))),
  groupBoxes: optional(recordOf(box)),
});

/** `value` as an {@link EffectDoc}, as `JSON.parse` reads one. Throws an {@link EffectDocShapeError} naming the first
 *  field of the wrong type. */
export function readEffectDoc(value: unknown): EffectDoc {
  doc(value, 'doc');
  return value as EffectDoc;
}
