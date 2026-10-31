import { describe, it, expect } from 'vitest';
import { BUILTIN_TOOL_IDS, TOOL_GROUP_ORDER, type Tool } from '@weasel-js/core';
import { groupTools } from './order';

const tool = (id: string, group?: string): Tool => ({ id, presentation: { label: id, group } }) as Tool;
const ids = (groups: ReturnType<typeof groupTools>) => groups.map(({ key, tools }) => [key, tools.map((t) => t.id)]);

describe('groupTools', () => {
  it('puts selection first, then navigation, then the tools that make things', () => {
    const list = [
      tool('text', 'type'), tool('pen', 'draw'), tool('hand', 'view'), tool('rect', 'shape'),
      tool('lasso', 'select'), tool('select', 'select'), tool('slice', 'page'),
    ];
    expect(ids(groupTools(list, TOOL_GROUP_ORDER, BUILTIN_TOOL_IDS))).toEqual([
      ['select', ['select', 'lasso']],
      ['view', ['hand']],
      ['shape', ['rect']],
      ['draw', ['pen']],
      ['type', ['text']],
      ['page', ['slice']],
    ]);
  });

  it('orders a group by the natural tool order, whatever order the tools registered in', () => {
    const list = ['star', 'line', 'rect', 'polygon', 'ellipse'].map((id) => tool(id, 'shape'));
    expect(ids(groupTools(list, TOOL_GROUP_ORDER, BUILTIN_TOOL_IDS))).toEqual([
      ['shape', ['rect', 'ellipse', 'line', 'polygon', 'star']],
    ]);
  });

  it('keeps tools the order does not name in registration order, after those it does', () => {
    const list = [tool('eyedropper', 'view'), tool('measure', 'view'), tool('hand', 'view')];
    expect(ids(groupTools(list, TOOL_GROUP_ORDER, BUILTIN_TOOL_IDS))).toEqual([
      ['view', ['hand', 'eyedropper', 'measure']],
    ]);
  });

  it('keeps unknown groups in registration order after the known ones, and misc last', () => {
    const list = [tool('orphan'), tool('b', 'zeta'), tool('select', 'select'), tool('a', 'alpha')];
    expect(ids(groupTools(list, TOOL_GROUP_ORDER, BUILTIN_TOOL_IDS))).toEqual([
      ['select', ['select']], ['zeta', ['b']], ['alpha', ['a']], ['misc', ['orphan']],
    ]);
  });

  it('lets a consumer order win over the natural one', () => {
    const list = [tool('select', 'select'), tool('hand', 'view'), tool('rect', 'shape'), tool('ellipse', 'shape')];
    expect(ids(groupTools(list, ['shape', 'select'], ['ellipse']))).toEqual([
      ['shape', ['ellipse', 'rect']], ['select', ['select']], ['view', ['hand']],
    ]);
  });
});

describe('the natural order', () => {
  it('names the built-in tool sets, selection and anchor editing then navigation first', () => {
    expect(TOOL_GROUP_ORDER).toEqual(['select', 'path-edit', 'view', 'shape', 'draw', 'type', 'page']);
    expect(BUILTIN_TOOL_IDS.slice(0, 4)).toEqual(['select', 'lasso', 'anchors', 'hand']);
  });
});
