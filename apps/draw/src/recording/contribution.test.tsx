import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { ActionsProvider, DepRegistryProvider, SceneCanvas, createScene } from '@weasel-js/core';
import { ActionBar } from '@weasel-js/ui/components/ActionBar';
import { recordingContribution } from './contribution';
import type { RecordingSession } from './session';
import { withIcons } from '../testIcons';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as { getContext: (...args: unknown[]) => unknown };
  proto.getContext = vi.fn(() => null);
});
afterEach(() => cleanup());

function setup(state: { recording?: boolean; playing?: boolean } = {}) {
  const detach = vi.fn();
  const session = {
    recording: state.recording ?? false,
    playing: state.playing ?? false,
    toggle: vi.fn(async () => {}),
    play: vi.fn(async () => {}),
    attach: vi.fn(() => detach),
  } satisfies RecordingSession;
  const scene = createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>(
    { systemLayers: [{ id: 'main' }] },
  );
  const view = render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActionBar group="record" />
        <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
          ambient={[recordingContribution(session)]} />
      </ActionsProvider>
    </DepRegistryProvider>,
    { wrapper: withIcons },
  );
  const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;
  const disabled = (b: HTMLButtonElement) => b.disabled || b.getAttribute('aria-disabled') === 'true';
  return { session, detach, view, button, disabled };
}

describe('recording contribution', () => {
  it('hands the session the mounted canvas, and takes it back on unmount', () => {
    const t = setup();
    expect(t.session.attach).toHaveBeenCalledOnce();
    const canvas = (t.session.attach.mock.calls[0] as unknown as [() => HTMLCanvasElement | null])[0];
    expect(canvas()).toBe(t.view.container.querySelector('canvas'));
    t.view.unmount();
    expect(t.detach).toHaveBeenCalledOnce();
  });

  it('F9 and the Record button both toggle the recording', () => {
    const t = setup();
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'F9' })); });
    expect(t.session.toggle).toHaveBeenCalledOnce();
    fireEvent.click(t.button('Record input'));
    expect(t.session.toggle).toHaveBeenCalledTimes(2);
  });

  it('shows Record as pressed while recording, with Play disabled', () => {
    const t = setup({ recording: true });
    expect(t.button('Record input').getAttribute('aria-pressed')).toBe('true');
    expect(t.disabled(t.button('Play recording'))).toBe(true);
  });

  it('plays from the Play button, and disables Record while playing', () => {
    const t = setup();
    fireEvent.click(t.button('Play recording'));
    expect(t.session.play).toHaveBeenCalledOnce();
    cleanup();
    const playing = setup({ playing: true });
    expect(playing.disabled(playing.button('Record input'))).toBe(true);
  });
});
