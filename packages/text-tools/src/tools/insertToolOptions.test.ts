import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTextTool } from './text/useTextTool';

type InsertTool = { bindings?: readonly { actionId: string; opts?: { behaviors?: unknown[] } }[] };

describe('the text tool carries its behaviors onto the insert binding', () => {
  it('text', () => {
    // Only identity is under test, so any object stands in for a behavior.
    const behaviors = [{}] as never[];
    const { result } = renderHook(() => useTextTool({ behaviors }));
    const insert = (result.current as InsertTool).bindings?.find((b) => b.actionId === 'insert');
    expect(insert?.opts?.behaviors).toEqual(behaviors);
  });
});
