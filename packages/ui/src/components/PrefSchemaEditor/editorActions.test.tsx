import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ActionsProvider, useAction } from '@weasel-js/core';
import type { PrefGroup } from '@weasel-js/prefs';
import { deadActionPaths, useEditorActions } from './editorActions';

afterEach(cleanup);

function Registered({ children }: { children: ReactNode }) {
  useAction({
    id: 'flip',
    label: 'Flip',
    tags: ['mirror'],
    invoker: { timing: 'immediate', run: () => {} },
    variants: [
      { key: 'x', label: 'Flip H', params: { axis: 'x' }, tags: ['horizontal'] },
      { key: 'y', label: 'Flip V', params: { axis: 'y' } },
    ],
  });
  return children;
}

describe('useEditorActions', () => {
  it('carries each registered entry’s tags', () => {
    const { result } = renderHook(() => useEditorActions(undefined), {
      wrapper: ({ children }) => <ActionsProvider><Registered>{children}</Registered></ActionsProvider>,
    });
    expect(result.current?.map((a) => [a.key, a.tags])).toEqual([['flip:x', ['mirror', 'horizontal']], ['flip:y', ['mirror']]]);
  });
});

describe('deadActionPaths', () => {
  const fires = (action: string) => ({ kind: 'action', action, name: '', description: '', default: undefined }) as const;
  it('takes a bare parametric id as live when any of its variants is, and an unknown key as dead', () => {
    const root: PrefGroup = { name: '', description: '', children: { a: fires('flip'), b: fires('flip:x'), c: fires('nowhere'), d: fires('fl') } };
    const dead = deadActionPaths(root, new Set(['flip:x', 'flip:y']), (parent, key) => (parent ? `${parent}/${key}` : key));
    expect([...dead]).toEqual(['c', 'd']);
  });
});
