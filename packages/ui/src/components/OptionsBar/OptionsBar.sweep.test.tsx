import { afterEach, describe, it, expect } from 'vitest';
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import { OptionsBar } from './OptionsBar';

afterEach(() => { delete (document as { elementFromPoint?: unknown }).elementFromPoint; });

function Bar({ calls }: { calls: string[] }) {
  const [on, setOn] = useState<Record<string, boolean>>({ a: false, b: true, c: false });
  return (
    <OptionsBar
      sweep
      aria-label="opts"
      items={(['a', 'b', 'c'] as const).map((v) => ({
        value: v,
        label: v,
        selected: on[v]!,
        onChange: (next: boolean) => { calls.push(`${v}:${next}`); setOn((o) => ({ ...o, [v]: next })); },
      }))}
    />
  );
}

describe('OptionsBar sweep', () => {
  it('sets each option a drag reaches, calling only those that change, and puts them back on cancel', () => {
    const calls: string[] = [];
    const utils = render(<Bar calls={calls} />);
    const buttons = utils.getAllByRole('button');
    document.elementFromPoint = (x: number) => buttons[Math.floor(x / 10)] ?? null;
    const fire = (type: string, x: number): void => {
      act(() => {
        buttons[0]!.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, button: 0, buttons: 1, clientX: x, clientY: 5 }));
      });
    };
    fire('pointerdown', 5);
    fire('pointermove', 25);
    expect(calls).toEqual(['a:true', 'c:true']);
    fire('pointercancel', 25);
    expect(calls).toEqual(['a:true', 'c:true', 'a:false', 'c:false']);
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });
});
