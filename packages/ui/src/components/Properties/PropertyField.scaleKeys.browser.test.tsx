import '@weasel-js/theme/tokens.css';
import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { logScale, type ContinuousScaleFactory } from '@weasel-js/plot/scales';
import { PropertyField } from '@weasel-js/ui/components/Properties';

afterEach(cleanup);

function Field({ scale, onInput }: { scale?: ContinuousScaleFactory; onInput: (n: number) => void }) {
  const [v, setV] = useState(9);
  return (
    <div style={{ width: 300 }}>
      <PropertyField
        kind="number"
        control="slider"
        label="Segments"
        value={v}
        min={1}
        max={1000}
        step={1}
        scale={scale}
        onInput={(n) => { setV(n); onInput(n); }}
        onChange={() => {}}
      />
    </div>
  );
}

/** Press `key` on the range input with focus on it, as a person does. */
async function pressOnTrack(key: string) {
  const el = screen.getByRole('slider');
  el.focus();
  await userEvent.keyboard(`{${key}}`);
}

describe.each(['ltr', 'rtl'] as const)('a scaled Properties slider under %s', (dir) => {
  test('steps the horizontal arrows the way the unscaled native track does', async () => {
    const seen: Record<string, number> = {};
    for (const scaled of [false, true]) {
      const onInput = vi.fn();
      const { unmount } = render(
        <div dir={dir}>
          <Field scale={scaled ? logScale : undefined} onInput={onInput} />
        </div>,
      );
      await pressOnTrack('ArrowRight');
      seen[scaled ? 'scaled' : 'native'] = onInput.mock.calls.at(-1)?.[0];
      unmount();
    }
    expect(seen.native).toBe(dir === 'rtl' ? 8 : 10);
    expect(seen.scaled).toBe(seen.native);
  });
});
