import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PresetBar } from './PresetBar';
import { BUILTIN_PRESETS } from './presets';

const writes: ((ok: boolean) => void)[] = [];
vi.mock('./presets', async (original) => ({
  ...(await original<object>()),
  persist: () => new Promise<boolean>((resolve) => { writes.push(resolve); }),
}));

afterEach(() => {
  cleanup();
  writes.length = 0;
});

describe('<PresetBar> with writes in flight', () => {
  it('reports the newest write, not an earlier one that lands after it', async () => {
    renderWithIcons(<PresetBar state={BUILTIN_PRESETS[0]!.state} saved={[]} onSavedChange={() => {}} onLoad={() => {}} />);
    const save = (name: string) => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Preset name' }), { target: { value: name } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    };
    save('one');
    save('two');
    await act(async () => { writes[1]!(true); });
    await act(async () => { writes[0]!(false); });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
