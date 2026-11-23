import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EditorScene } from './editorMapping';
import { useEditorPicks } from './editorPicks';

const built = {
  stageOf: (id: string) => (id === 's1' ? {} : undefined),
  clusterOf: () => undefined,
  wireOf: (id: string) => (id === 'w1' ? {} : undefined),
} as never as EditorScene;

describe('useEditorPicks', () => {
  it('forgets a picked wire once a controlled selection shows a stage', () => {
    const { result, rerender } = renderHook(
      ({ selected }: { selected: string | null }) => useEditorPicks(built, { selected }),
      { initialProps: { selected: null as string | null } },
    );
    act(() => result.current.pick('w1'));
    rerender({ selected: null });
    expect(result.current.shown).toBe('w1');
    rerender({ selected: 's1' });
    expect(result.current.shown).toBe('s1');
    rerender({ selected: null });
    expect(result.current.shown).toBeNull();
  });
});
