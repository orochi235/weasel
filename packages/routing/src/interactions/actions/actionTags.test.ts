import { describe, it, expect } from 'vitest';
import { actionItems } from './actionItems';
import { actionsTagged, matchActionItem, taggedActionItems } from './actionTags';
import type { Action } from './action';

const run = () => {};

const union: Action = { id: 'union', label: 'Union', tags: ['boolean'], invoker: { timing: 'immediate', run } };
const flip: Action = {
  id: 'flip',
  label: 'Flip',
  tags: ['transform'],
  invoker: { timing: 'immediate', run },
  variants: [
    { key: 'x', label: 'Flip Horizontal', params: { axis: 'x' }, tags: ['mirror'] },
    { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } },
  ],
};
const knife: Action = { id: 'knife', label: 'Knife', tags: ['boolean'], invoker: { timing: 'ongoing', start: () => null } as never };
const all = [union, flip, knife];

describe('action tags', () => {
  it('gives each entry its action’s tags, and a variant’s own after them', () => {
    expect(actionItems(flip).map((i) => i.tags)).toEqual([['transform', 'mirror'], ['transform']]);
    expect(actionItems(union)[0]!.tags).toEqual(['boolean']);
  });

  it('gathers the actions carrying a tag, a drag included, and one whose variant carries it', () => {
    expect(actionsTagged(all, 'boolean').map((a) => a.id)).toEqual(['union', 'knife']);
    expect(actionsTagged(all, 'mirror').map((a) => a.id)).toEqual(['flip']);
  });

  it('gathers the entries carrying a tag, only the variant that carries it', () => {
    expect(taggedActionItems(all, 'mirror').map((i) => i.key)).toEqual(['flip:x']);
    expect(taggedActionItems(all, 'transform').map((i) => i.key)).toEqual(['flip:x', 'flip:y']);
  });

  it('finds an entry by its label or by a tag', () => {
    const [h, v] = actionItems(flip);
    expect(matchActionItem(h!, 'horiz')).toEqual({ by: 'text' });
    expect(matchActionItem(h!, 'mirr')).toEqual({ by: 'tag', tag: 'mirror' });
    expect(matchActionItem(v!, 'mirr')).toBeNull();
  });
});
