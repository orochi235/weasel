import { describe, expect, it } from 'vitest';
import { prefUnit, resolvePrefUnit, type PrefGroup, type PrefNumber, type PrefNumberUnit } from '@weasel-js/prefs';
import { ANGLE_RADIANS, METRIC_MM } from '@weasel-js/quantity';
import type { DraftStorage } from './document';
import { packDraft, unpackDraft } from './draft';
import { attributeSchema } from './kindSchemas';
import { schemaCodec } from './schemaCodec';
import { nodeAt, setAttribute } from './schemaEdit';
import { KEEP, printSchema } from './schemaExport';
import { NO_TYPES } from './types';

const CELSIUS: PrefNumberUnit = { suffix: '°C', scale: 1, offset: 273.15, precision: 1, accepts: { K: { factor: 1, offset: -273.15 }, '°F': { factor: 5 / 9, offset: -160 / 9 } } };
const halved: PrefNumberUnit = { toDisplay: (v) => Math.sqrt(v), fromDisplay: (v) => v * v, suffix: '√' };

const number = (name: string, unit: PrefNumberUnit): PrefNumber => ({ kind: 'number', name, description: '', default: 0, unit });

/** Every unit here but `root` is data. */
const SCHEMA: PrefGroup = {
  name: 'Root',
  children: {
    page: {
      name: 'Page',
      as: 'page',
      children: {
        angle: number('Angle', prefUnit(ANGLE_RADIANS, 'deg', { precision: 1, suffix: '°' })),
        width: number('Width', prefUnit(METRIC_MM, 'cm')),
        heat: number('Heat', CELSIUS),
        plain: number('Plain', { scale: 1 }),
      },
    },
  },
};
const WITH_CODE: PrefGroup = { ...SCHEMA, children: { ...SCHEMA.children, root: number('Root', halved) } };

const evaluated = (text: string): unknown => new Function(`return (${text});`)();
const throughJson = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const memory = (): DraftStorage => {
  const held = new Map<string, string>();
  return { getItem: (k) => held.get(k) ?? null, setItem: (k, v) => { held.set(k, v); }, removeItem: (k) => { held.delete(k); } };
};

describe('a schema whose numbers carry units as data', () => {
  it('prints as a literal that evaluates back equal, with no code to keep from the source', () => {
    const text = printSchema(SCHEMA);
    expect(text).not.toContain(KEEP);
    expect(evaluated(text)).toEqual(SCHEMA);
  });

  it('prints a unit of functions as code to keep, and the data units beside it in full', () => {
    const text = printSchema(WITH_CODE);
    expect(text.match(new RegExp(KEEP, 'g'))).toHaveLength(1);
    expect(text).toContain("suffix: '°C'");
  });

  it('packs to a draft that comes back from JSON equal, against a source that holds none of the units', () => {
    const bare = throughJson(SCHEMA);
    for (const leaf of Object.values((bare.children.page as PrefGroup).children)) delete (leaf as { unit?: unknown }).unit;
    expect(unpackDraft(throughJson(packDraft(SCHEMA, SCHEMA)), SCHEMA)).toEqual(SCHEMA);
    expect(unpackDraft(throughJson(packDraft(SCHEMA, bare)), bare)).toEqual(SCHEMA);
  });

  it('comes back from the draft codec equal, a unit set on a new leaf included', () => {
    const codec = schemaCodec<PrefGroup>(NO_TYPES);
    const storage = memory();
    const edited = setAttribute(WITH_CODE, 'page/plain', 'unit', { suffix: 'pt', scale: 0.75 });
    codec.saveDraft('k', edited, WITH_CODE, { version: 1, undoStack: [], redoStack: [], nextEntryId: 1, droppedEntries: 0 }, 1, storage);
    const opened = codec.openDraft('k', WITH_CODE, storage)!;
    expect(opened.value).toEqual(edited);
    expect((nodeAt(opened.value, 'root') as PrefNumber).unit).toBe(halved);
  });

  it('converts the same after the trip as before it', () => {
    const back = unpackDraft(throughJson(packDraft(SCHEMA, SCHEMA)), SCHEMA);
    const unitAt = (root: PrefGroup, path: string) => resolvePrefUnit((nodeAt(root, path) as PrefNumber).unit!);
    for (const path of ['page/angle', 'page/width', 'page/heat', 'page/plain']) {
      expect(unitAt(back, path).toDisplay(1.2345)).toBe(unitAt(SCHEMA, path).toDisplay(1.2345));
      expect(unitAt(back, path).fromDisplay(7)).toBe(unitAt(SCHEMA, path).fromDisplay(7));
      expect(unitAt(back, path).format(1.2345)).toBe(unitAt(SCHEMA, path).format(1.2345));
    }
  });
});

describe('a number leaf in the attribute form', () => {
  it('offers a unit of data, and a missing one, as an attribute to edit', () => {
    expect(attributeSchema(nodeAt(SCHEMA, 'page/heat')!).own.unit).toMatchObject({ kind: 'unit', name: 'Unit' });
    expect(attributeSchema({ kind: 'number', name: 'N', description: '', default: 0 }).own.unit).toMatchObject({ kind: 'unit' });
    expect(attributeSchema(nodeAt(SCHEMA, 'page/heat')!).readOnly).toEqual([]);
  });

  it('lists a unit of functions as code, read and not edited', () => {
    const { own, readOnly } = attributeSchema(nodeAt(WITH_CODE, 'root')!);
    expect(own.unit).toBeUndefined();
    expect(readOnly).toEqual([['unit', halved]]);
  });
});
