import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { f } from '../config/builder';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';

// The plot itself is ui's to test; here it only has to hand over the callbacks a drag runs through.
type Points = { x: number; y: number }[];
const editor = vi.hoisted(() => ({
  props: null as null | { onInput: (p: Points) => void; onChange: (p: Points) => void },
}));
vi.mock('@weasel-js/ui/components/CurveEditor', async (importOriginal) => {
  const real = await importOriginal<typeof import('@weasel-js/ui/components/CurveEditor')>();
  return {
    ...real,
    CurveEditor: (props: NonNullable<typeof editor.props>) => {
      editor.props = props;
      return null;
    },
  };
});

const shaped = defineInstrument({
  name: 'Shaped',
  config: f.schema({ falloff: f.curve([0, 0, 1, 1]).range(0, 1).step(0.1) }),
  initialState: () => ({}),
  render: (ctx) => <output aria-label="falloff">{ctx.config.falloff.join(' ')}</output>,
});

const mount = () => renderSettled(<Lab instruments={[shaped]} />, { wrapper: withIcons });
const falloff = () => screen.getByLabelText('falloff').textContent;
const move = (y: number) =>
  act(() =>
    editor.props?.onInput([
      { x: 0, y },
      { x: 1, y: 1 },
    ]),
  );
const settle = (y: number) =>
  act(() =>
    editor.props?.onChange([
      { x: 0, y },
      { x: 1, y: 1 },
    ]),
  );
const undo = () => screen.getByRole('button', { name: 'Undo' });

afterEach(() => {
  vi.useRealTimers();
});

describe('an f.curve row', () => {
  it('draws a curve field under its label', async () => {
    await mount();
    expect(screen.getByText('Falloff')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flip horizontally/i })).toBeInTheDocument();
  });

  it('is one undo step for a drag however long it pauses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await mount();
    move(0.2);
    vi.advanceTimersByTime(800);
    move(0.4);
    settle(0.4);
    expect(falloff()).toBe('0 0.4 1 1');
    fireEvent.click(undo());
    expect(falloff()).toBe('0 0 1 1');
    expect(undo()).toBeDisabled();
  });
});
