import { act, fireEvent, screen } from '@testing-library/react';
import {
  type ActionsRegistry,
  type BindingOverrides,
  key,
  type RectPose,
  useActionsRegistry,
} from '@weasel-js/core';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { KeymapHint } from '@weasel-js/ui/components/KeymapHint';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineInstrument } from '../../instrument/defineInstrument';
import { Lab } from '../../lab/Lab';
import { LensActions } from './LensActions';
import { LENS_ACTION_IDS } from './lensActionDefs';
import { lensApiFixture } from './lensApi.fixture';
import { lensesOf, settingsOf } from './lensScene';

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => null,
  ) as unknown as HTMLCanvasElement['getContext'];
});

const Story = defineInstrument<Record<string, never>, Record<string, never>>({
  name: 'Story',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => <input aria-label="Story text" />,
});

let api: ReturnType<typeof lensApiFixture>;
let registry: ActionsRegistry;
let hide: () => void;

function Loupe({ overrides }: { overrides?: BindingOverrides }) {
  const bodyRef = useRef<HTMLElement | null>(null);
  // Before any effect below, so the follow dispatcher finds its element.
  useLayoutEffect(() => {
    bodyRef.current = document.querySelector('.lk-lab__body');
  }, []);
  registry = useActionsRegistry() as ActionsRegistry;
  useEffect(() => (overrides ? registry.overrideBindings(overrides) : undefined), [overrides]);
  const [shown, setShown] = useState(true);
  hide = () => setShown(false);
  return (
    <>
      {shown ? <LensActions api={api} bodyRef={bodyRef} opposite={() => 'dark'} /> : null}
      <KeymapHint />
    </>
  );
}

async function mount(overrides?: BindingOverrides): Promise<HTMLElement> {
  const { container } = await renderSettled(
    <Lab
      instruments={[Story]}
      defaultInstrument="Story"
      labChrome={[
        {
          id: 'loupe',
          region: 'overlay',
          render: () => <Loupe {...(overrides ? { overrides } : {})} />,
        },
      ]}
    />,
    { wrapper: withIcons },
  );
  return container.querySelector('.lk-lab__body') as HTMLElement;
}

/** One keystroke, down and up, on `target`. */
function tap(target: Element, init: KeyboardEventInit) {
  act(() => {
    fireEvent.keyDown(target, init);
    fireEvent.keyUp(target, init);
  });
}

const LEADER = { code: 'KeyL', key: 'l', altKey: true };
const hint = () => screen.queryByText('Loupe');
const centerOf = (p: RectPose) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

beforeEach(() => {
  api = lensApiFixture();
});

describe('<LensActions>', () => {
  it('opens the Loupe keymap on Alt+L and adds a lens on l', async () => {
    const body = await mount();
    tap(body, LEADER);
    expect(hint()).toBeVisible();
    tap(body, { code: 'KeyL', key: 'l' });
    expect(lensesOf(api.scene)).toHaveLength(1);
    expect(hint()).toBeNull();
  });

  it('switches aim to Follow, tracks hover without writing history, and commits one step on Pinned', async () => {
    const body = await mount();
    act(() => void registry.trigger(LENS_ACTION_IDS.add));
    const lengthBefore = api.scene.history.undoDepth();
    act(() => void registry.trigger(LENS_ACTION_IDS.follow));
    act(() => {
      fireEvent.pointerMove(body, { clientX: 50, clientY: 60 });
      fireEvent.pointerMove(body, { clientX: 70, clientY: 80 });
    });
    expect(api.scene.history.undoDepth()).toBe(lengthBefore + 1);
    expect(api.scene.overrides.read('l0:reticle' as never)?.pose).toMatchObject({ x: 62, y: 72 });
    act(() => void registry.trigger(LENS_ACTION_IDS.pinned));
    expect(centerOf(api.scene.get('l0:reticle' as never)!.pose)).toEqual({ x: 70, y: 80 });
    expect(api.scene.history.undoDepth()).toBe(lengthBefore + 2);
    expect(api.scene.overrides.has('l0:reticle' as never)).toBe(false);
    expect(settingsOf(api.scene, 'l0')!.aim).toBe('pinned');
  });

  it('drops a Follow reticle’s held pose when its lens closes', async () => {
    const body = await mount();
    act(() => void registry.trigger(LENS_ACTION_IDS.add));
    act(() => void registry.trigger(LENS_ACTION_IDS.follow));
    act(() => {
      fireEvent.pointerMove(body, { clientX: 50, clientY: 60 });
    });
    expect(api.scene.overrides.has('l0:reticle' as never)).toBe(true);
    act(() => void registry.trigger(LENS_ACTION_IDS.close));
    expect(api.scene.overrides.has('l0:reticle' as never)).toBe(false);
  });

  it('uninstalls the keymap and its actions when it unmounts', async () => {
    const body = await mount();
    await act(async () => hide());
    expect(registry.list().some((a) => a.id.startsWith('loupe.') || a.id === 'keymap.loupe')).toBe(false);
    tap(body, LEADER);
    expect(hint()).toBeNull();
    tap(body, { code: 'KeyL', key: 'l' });
    expect(lensesOf(api.scene)).toHaveLength(0);
  });

  it('leaves a pinned reticle where it is when the pointer moves', async () => {
    const body = await mount();
    act(() => void registry.trigger(LENS_ACTION_IDS.add));
    act(() => {
      fireEvent.pointerMove(body, { clientX: 50, clientY: 60 });
    });
    expect(api.scene.overrides.has('l0:reticle' as never)).toBe(false);
  });

  it('types l into a story’s text input without adding a lens and without opening the keymap', async () => {
    await mount();
    const input = screen.getByRole('textbox', { name: 'Story text' });
    await act(async () => input.focus());
    tap(input, { code: 'KeyL', key: 'l' });
    expect(lensesOf(api.scene)).toHaveLength(0);
    expect(hint()).toBeNull();
    // Nor does the leader open the keymap from inside the field.
    tap(input, LEADER);
    expect(hint()).toBeNull();
  });

  it('rebinds add through bindingOverrides by its id', async () => {
    const body = await mount({ [LENS_ACTION_IDS.add]: key('n') });
    tap(body, LEADER);
    tap(body, { code: 'KeyL', key: 'l' });
    expect(lensesOf(api.scene)).toHaveLength(0);
    // A tapped keymap swallows the unbound l and stays open for n.
    tap(body, { code: 'KeyN', key: 'n' });
    expect(lensesOf(api.scene)).toHaveLength(1);
    tap(body, LEADER);
    tap(body, { code: 'KeyN', key: 'n' });
    expect(lensesOf(api.scene)).toHaveLength(2);
  });
});
