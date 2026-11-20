import { act, renderHook } from '@testing-library/react';
import type { RecordCache } from '@weasel-js/storage';
import { describe, expect, it } from 'vitest';
import type { ClockCapability } from './trialClock';
import { useLabClocks } from './useLabClocks';

function memoryRecords(): RecordCache & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get: (name: string) => values.get(name),
    set: (name: string, value: unknown) => void values.set(name, value),
  } as unknown as RecordCache & { values: Map<string, unknown> };
}

describe('useLabClocks', () => {
  it("records the lab clock's position against the declaration it opened from", () => {
    const records = memoryRecords();
    const { result, rerender } = renderHook(
      ({ spec }: { spec: ClockCapability }) => useLabClocks(spec, records),
      { initialProps: { spec: { duration: 1000 } } },
    );
    rerender({ spec: { duration: 2000 } });
    act(() => result.current.shared?.clock.seek(500));
    const [position] = [...records.values.values()];
    expect(position).toEqual({ elapsed: 500, rate: 0 });
  });
});
