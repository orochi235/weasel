import { describe, expect, it } from 'vitest';
import { mergeMenuDefs, pickMenu } from './pickMenu';
import type { MenuDef } from './types';

const sel: MenuDef = { id: 'sel', when: { bodyTarget: ['selected-body'] }, sections: [[{ action: 'cut' }]] };
const text: MenuDef = { id: 'text', when: { bodyTarget: 'selected-body', bodyKind: 'text' }, sections: [[{ action: 'editText' }]] };
const empty: MenuDef = { id: 'canvas', when: { bodyTarget: 'empty' }, sections: [[{ action: 'paste' }]] };
const chrome: MenuDef = { id: 'row', sections: [[{ action: 'delete' }]] };

describe('pickMenu', () => {
  it('takes the first def whose when matches', () => {
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'text' })?.id).toBe('text');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'selected-body', bodyKind: 'rect' })?.id).toBe('sel');
    expect(pickMenu([text, sel, empty], { bodyTarget: 'empty' })?.id).toBe('canvas');
  });
  it('never picks a def with no when', () => {
    expect(pickMenu([chrome], { bodyTarget: 'empty' })).toBeUndefined();
  });
});

describe('mergeMenuDefs', () => {
  it('joins same-id defs section by section, ambient before the active tool', () => {
    const tool: MenuDef = { id: 'sel', sections: [[{ action: 'toolA' }], [{ action: 'toolB' }]] };
    const merged = mergeMenuDefs([{ def: tool, owner: 'pen' }, { def: sel, owner: null }], 'pen');
    expect(merged).toHaveLength(1);
    expect(merged[0]!.when).toEqual(sel.when);
    expect(merged[0]!.sections).toEqual([[{ action: 'cut' }, { action: 'toolA' }], [{ action: 'toolB' }]]);
  });
  it('drops a tool def while another tool is active', () => {
    const tool: MenuDef = { id: 'sel', sections: [[{ action: 'toolA' }]] };
    expect(mergeMenuDefs([{ def: sel, owner: null }, { def: tool, owner: 'pen' }], 'select')[0]!.sections)
      .toEqual([[{ action: 'cut' }]]);
  });
});
