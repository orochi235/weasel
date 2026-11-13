import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { createMemoryAdapter } from '@weasel-js/storage';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { useAnnotations } from './AnnotationsContext';
import type { AnnotationsApi } from './types';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

let api: AnnotationsApi | null = null;

function Pane() {
  api = useAnnotations();
  return <div data-testid="pane" />;
}

const annotating = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Annotating',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <Pane />,
  annotations: {
    targets: () => [{ id: 'pane', ref: { current: null }, content: { w: 200, h: 100 } }],
  },
});

const palette = () => screen.queryByRole('toolbar', { name: /Rectangle|Text|mark/ });

async function mount() {
  await renderSettled(
    <Lab instruments={[annotating]} storageKey="options-test" storage={createMemoryAdapter()} />,
    { wrapper: withIcons },
  );
  await waitFor(() => expect(api).not.toBeNull());
}

function marks(): AnnotationsApi {
  if (!api) throw new Error('no marks');
  return api;
}

describe('the annotation options palette', () => {
  beforeEach(() => {
    api = null;
  });

  it('is not there with Interact, and draws a drawing tool’s options', async () => {
    await mount();
    expect(palette()).toBeNull();
    act(() => screen.getByRole('button', { name: 'Rectangle' }).click());
    await waitFor(() => expect(palette()).not.toBeNull());
    expect(screen.getByLabelText('Width')).toHaveValue('2');
  });

  it("restyles Select's selection, as one undo step", async () => {
    await mount();
    const frac = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };
    const a = marks().add({ target: 'pane', kind: 'rect', frac, width: 4 });
    const b = marks().add({ target: 'pane', kind: 'ellipse', frac });
    act(() => marks().setSelection([a, b]));
    act(() => screen.getByRole('button', { name: 'Select' }).click());
    const width = await screen.findByLabelText('Width');
    expect(width).toHaveValue('');
    await userEvent.clear(width);
    await userEvent.type(width, '9{Enter}');
    await waitFor(() => expect(marks().get(a)?.width).toBe(9));
    expect(marks().get(b)?.width).toBe(9);
    act(() => {
      marks().undo();
    });
    expect([marks().get(a)?.width, marks().get(b)?.width]).toEqual([4, undefined]);
  });
});
