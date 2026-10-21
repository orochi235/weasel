import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent, act } from '@testing-library/react';
import {
  ActionsProvider,
  DepRegistryProvider,
  useAction,
  useDepSource,
  useDepRegistry,
  type DepRegistry,
  type DepName,
  clipboardCutAction,
  clipboardCopyAction,
  clipboardPasteAction,
  type Action,
} from '@weasel-js/core';
import type { IconRef } from '@weasel-js/icons';
import { ActionBar } from './ActionBar';
import { icon } from '../../icons.gen';
import { Icon } from '../../icons/Icon';
import { renderWithIcons } from '../../testing/withIcons';
import barStyles from '../Bar/Bar.module.css';

/**
 * Test harness: registers a set of `Action` descriptors on mount via
 * `useAction`, then renders an `<ActionBar>` filtered to `group`. Keeps
 * each test focused on a single scenario without duplicating provider
 * wiring.
 */
function Harness(props: { actions: Action[]; bar: React.ReactElement }) {
  return (
    <ActionsProvider>
      {props.actions.map((a) => (
        <Register key={a.id} action={a} />
      ))}
      {props.bar}
    </ActionsProvider>
  );
}

function Register({ action }: { action: Action }) {
  useAction(action);
  return null;
}

function makeAction(partial: Partial<Action> & Pick<Action, 'id'> & { run?: () => void }): Action {
  const { run, ...rest } = partial;
  return {
    label: partial.id,
    group: 'demo',
    invoker: { timing: 'immediate', run: () => { run?.(); } },
    ...rest,
  };
}

/** The bar's button for the action labeled `label`; a label is the action's id unless a test gives one. */
const item = (label: string) => screen.getByRole('button', { name: label });

describe('ActionBar', () => {
  it('renders empty toolbar when no actions match the group (no crash)', () => {
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'other', group: 'something-else' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar.querySelectorAll('button').length).toBe(0);
  });

  it('draws a bar from a tag: the actions carrying it, and the variants that do', () => {
    renderWithIcons(
      <Harness
        actions={[
          makeAction({ id: 'union', tags: ['boolean'] }),
          makeAction({ id: 'paste' }),
          makeAction({
            id: 'flip',
            variants: [
              { key: 'x', label: 'Flip H', params: { axis: 'x' }, tags: ['boolean'] },
              { key: 'y', label: 'Flip V', params: { axis: 'y' } },
            ],
          }),
        ]}
        bar={<ActionBar tag="boolean" />}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['union', 'Flip H']);
    expect(screen.getByRole('toolbar', { name: 'boolean actions' })).toBeTruthy();
  });

  it('renders one button per action in the group', () => {
    renderWithIcons(
      <Harness
        actions={[
          makeAction({ id: 'a' }),
          makeAction({ id: 'b' }),
          makeAction({ id: 'c', group: 'other' }),
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(2);
    expect(item('a')).toBeTruthy();
    expect(item('b')).toBeTruthy();
  });

  it('clicking an enabled button triggers the action.run', () => {
    const run = vi.fn();
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'a', run })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    fireEvent.click(item('a'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('disabled state from evaluateEnabled reflects on the button', () => {
    renderWithIcons(
      <Harness
        actions={[
          makeAction({ id: 'on', enabled: () => true }),
          makeAction({ id: 'off', enabled: () => 'selection-required' }),
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const on = item('on') as HTMLButtonElement;
    const off = item('off') as HTMLButtonElement;
    expect(on.getAttribute('aria-disabled')).toBeNull();
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(off.getAttribute('aria-description')).toBe('Selection required');
  });

  // Dep sources publish on commit, so the render that changes one reads the
  // one before it; the bar has to catch up once it commits.
  it('follows a dep that changes in the same render as the bar', () => {
    const action = makeAction({
      id: 'gated',
      requires: ['gate' as DepName],
      enabled: (deps) => ((deps as Record<string, unknown> | undefined)?.gate ? true : 'not-applicable'),
    });
    function Gate({ open }: { open: boolean }) {
      useDepSource('gate' as DepName, () => open as never);
      return null;
    }
    const view = (open: boolean) => (
      <DepRegistryProvider>
        <ActionsProvider>
          <Register action={action} />
          <Gate open={open} />
          <ActionBar group="demo" />
        </ActionsProvider>
      </DepRegistryProvider>
    );
    const { rerender } = renderWithIcons(view(false));
    const button = () => item('gated') as HTMLButtonElement;
    expect(button().getAttribute('aria-disabled')).toBe('true');
    rerender(view(true));
    expect(button().getAttribute('aria-disabled')).toBeNull();
  });

  it('follows a dep whose owner says it changed, with nothing re-rendering the bar', () => {
    const action = makeAction({
      id: 'gated',
      requires: ['gate' as DepName],
      enabled: (deps) => ((deps as Record<string, unknown> | undefined)?.gate ? true : 'not-applicable'),
    });
    // The gate lives outside React, as a selection held in a store does.
    const gate = { open: false };
    let registry!: DepRegistry;
    function Gate() {
      registry = useDepRegistry();
      useDepSource('gate' as DepName, () => gate.open as never);
      return null;
    }
    renderWithIcons(
      <DepRegistryProvider>
        <ActionsProvider>
          <Register action={action} />
          <Gate />
          <ActionBar group="demo" />
        </ActionsProvider>
      </DepRegistryProvider>,
    );
    const button = () => item('gated') as HTMLButtonElement;
    expect(button().getAttribute('aria-disabled')).toBe('true');
    act(() => { gate.open = true; registry.changed!(); });
    expect(button().getAttribute('aria-disabled')).toBeNull();
  });

  it('clicking a disabled button does not invoke run', () => {
    const run = vi.fn();
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'off', run, enabled: () => 'not-applicable' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    fireEvent.click(item('off'));
    expect(run).not.toHaveBeenCalled();
  });

  it('icons prop names a glyph that replaces the action.icon for that id only', () => {
    const glyph = (ref: IconRef) =>
      renderWithIcons(<Icon name={ref} />).container.querySelector('svg')!.innerHTML;
    const [close, add, remove] = [glyph(icon('close')), glyph(icon('add')), glyph(icon('remove'))];
    renderWithIcons(
      <Harness
        actions={[
          makeAction({ id: 'a', icon: icon('add') }),
          makeAction({ id: 'b', icon: icon('remove') }),
        ]}
        bar={<ActionBar group="demo" icons={{ a: icon('close') }} />}
      />,
    );
    expect(item('a').querySelector('svg')!.innerHTML).toBe(close);
    expect(item('a').querySelector('svg')!.innerHTML).not.toBe(add);
    expect(item('b').querySelector('svg')!.innerHTML).toBe(remove);
  });

  it('labels prop overrides aria-label and tooltip for that id only', () => {
    renderWithIcons(
      <Harness
        actions={[
          makeAction({ id: 'a', label: 'Alpha' }),
          makeAction({ id: 'b', label: 'Beta' }),
        ]}
        bar={<ActionBar group="demo" labels={{ a: 'Aleph' }} />}
      />,
    );
    const a = item('Aleph');
    expect(a.getAttribute('aria-label')).toBe('Aleph');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => a.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Aleph');
    expect(item('Beta')).toBeTruthy();
  });

  it('shortcut appears in tooltip (in parentheses)', () => {
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'a', label: 'Alpha', shortcut: 'A' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const a = item('Alpha');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => a.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Alpha (A)');
  });

  it('runs the way `orientation` says, across by default', () => {
    const bar = (orientation?: 'vertical') => (
      <Harness actions={[makeAction({ id: 'a' })]} bar={<ActionBar group="demo" orientation={orientation} />} />
    );
    const { unmount } = renderWithIcons(bar('vertical'));
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'vertical');
    expect(item('a')).toBeTruthy();
    unmount();
    renderWithIcons(bar());
    expect(screen.getByRole('toolbar')).toHaveAttribute('aria-orientation', 'horizontal');
  });

  it('keeps the order the registry lists the actions in', () => {
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'z.last' }), makeAction({ id: 'a.first' }), makeAction({ id: '10' }), makeAction({ id: '2' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['z.last', 'a.first', '10', '2']);
  });

  it('forwards className to the toolbar root', () => {
    const { container } = renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'a' })]}
        bar={<ActionBar group="demo" className="custom-cls" />}
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(root.classList.contains('custom-cls')).toBe(true);
  });

  it("sits on Bar's segmented strip, not a framed one", () => {
    renderWithIcons(<ActionBar group="demo" />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toHaveClass(barStyles.segmented);
    expect(toolbar).not.toHaveClass(barStyles.framed);
  });

  it('renders nothing (empty toolbar) when no ActionsProvider is in scope', () => {
    renderWithIcons(<ActionBar group="demo" />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.querySelectorAll('button').length).toBe(0);
  });

  it('keeps only the entries `only` names, by action id or by variant key', () => {
    const variants = [{ key: 'x', label: 'Flip X', params: {} }, { key: 'y', label: 'Flip Y', params: {} }];
    renderWithIcons(
      <Harness
        actions={[makeAction({ id: 'a' }), makeAction({ id: 'b' }), makeAction({ id: 'flip', variants })]}
        bar={<ActionBar group="demo" only={['b', 'flip:y']} />}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['b', 'Flip Y']);
  });

  it('renders one button per variant and triggers with its params', () => {
    const run = vi.fn();
    renderWithIcons(
      <Harness
        actions={[
          {
            id: 'flip',
            label: 'Flip',
            group: 'demo',
            variants: [
              { key: 'x', label: 'Flip Horizontal', params: { axis: 'x' } },
              { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } },
            ],
            invoker: { timing: 'immediate', run: (_deps, params) => run(params) },
          },
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    expect(screen.getAllByRole('button').map((b) => b.getAttribute('aria-label')))
      .toEqual(['Flip Horizontal', 'Flip Vertical']);
    fireEvent.click(item('Flip Vertical'));
    expect(run).toHaveBeenCalledWith({ axis: 'y' });
  });

  it("titles a variant with the shortcut of the binding that passes its params", () => {
    renderWithIcons(
      <Harness
        actions={[
          makeAction({
            id: 'flip',
            label: 'Flip',
            variants: [
              { key: 'x', label: 'Flip Horizontal', params: { axis: 'x' } },
              { key: 'y', label: 'Flip Vertical', params: { axis: 'y' } },
            ],
            defaultBinding: [
              { spec: { kind: 'key', key: 'h', mods: { shift: true } }, opts: { params: { axis: 'x' } } },
              { spec: { kind: 'key', key: 'v', mods: { shift: true } }, opts: { params: { axis: 'y' } } },
            ],
          }),
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const y = item('Flip Vertical');
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => y.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Flip Vertical (Shift+V)');
  });
});

describe('ActionBar kit glyphs', () => {
  it('draws the standard edit actions with no icons map', () => {
    renderWithIcons(
      <Harness
        actions={[clipboardCutAction, clipboardCopyAction, clipboardPasteAction]}
        bar={<ActionBar group="clipboard" />}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      expect(button.querySelector('svg'), button.getAttribute('aria-label') ?? '').not.toBeNull();
    }
  });
});

describe('ActionBar previews', () => {
  function previewing(enabled = true) {
    const hide = vi.fn();
    const preview = vi.fn(() => hide);
    const run = vi.fn();
    renderWithIcons(
      <Harness
        actions={[makeAction({
          id: 'demo.peek', preview, run, ...(enabled ? {} : { enabled: () => 'selection-required' as const }),
        })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    return { preview, hide, run };
  }

  it('shows the action\'s preview while its button is hovered', () => {
    const { preview, hide } = previewing();
    fireEvent.pointerEnter(item('demo.peek'));
    expect(preview).toHaveBeenCalledTimes(1);
    expect(hide).not.toHaveBeenCalled();
    fireEvent.pointerLeave(item('demo.peek'));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('shows it while the button is focused, and takes it down on a press', () => {
    const { preview, hide, run } = previewing();
    fireEvent.focus(item('demo.peek'));
    expect(preview).toHaveBeenCalledTimes(1);
    fireEvent.click(item('demo.peek'));
    expect(hide).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('shows nothing for a disabled action', () => {
    const { preview } = previewing(false);
    fireEvent.pointerEnter(item('demo.peek'));
    expect(preview).not.toHaveBeenCalled();
  });
});
