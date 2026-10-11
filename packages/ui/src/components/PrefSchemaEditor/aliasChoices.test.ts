import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { describe, expect, it } from 'vitest';
import { prefFieldChoices } from '../Prefs/schema';
import { aliasChoices } from './aliasChoices';

const flag = (name: string): PrefLeaf => ({ kind: 'boolean', name, description: '', default: false });
const alias = (of: string): PrefLeaf => ({ kind: 'alias', name: '', description: '', default: undefined, of }) as PrefLeaf;

const SCHEMA: PrefGroup = {
  name: '',
  children: {
    grid: flag('Grid'),
    stroke: { kind: 'object', name: 'Stroke', description: '', default: {}, children: { on: flag('On') } } as PrefLeaf,
    view: { name: 'View', children: { grid: alias('grid'), again: alias('view.grid'), lost: alias('nowhere') } },
  },
};
const view = (SCHEMA.children.view as PrefGroup).children as Record<string, PrefLeaf>;
const offered = (...aliases: PrefLeaf[]): string[] => aliasChoices(SCHEMA, aliases, prefFieldChoices(SCHEMA)).map((c) => c.path);

describe('what an alias may be an alias of', () => {
  it('offers a whole leaf and an alias that leads to one, and no field inside an object', () => {
    expect(offered(view.lost!)).toEqual(['grid', 'stroke', 'view.grid', 'view.again']);
  });

  it('leaves out the alias itself and any alias that leads back to it', () => {
    expect(offered(view.grid!)).toEqual(['grid', 'stroke']);
  });

  it('offers several aliases only what every one of them could show', () => {
    expect(offered(view.again!, view.lost!)).toEqual(['grid', 'stroke', 'view.grid']);
  });
});
