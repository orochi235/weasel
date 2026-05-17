import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ActionsProvider,
  useAction,
  type Action,
} from '@orochi235/weasel';
import { ActionBar } from './ActionBar';

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

describe('ActionBar', () => {
  it('renders empty toolbar when no actions match the group (no crash)', () => {
    render(
      <Harness
        actions={[makeAction({ id: 'other', group: 'something-else' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeTruthy();
    expect(toolbar.querySelectorAll('button').length).toBe(0);
  });

  it('renders one button per action in the group', () => {
    render(
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
    expect(screen.getByTestId('action-bar-item-a')).toBeTruthy();
    expect(screen.getByTestId('action-bar-item-b')).toBeTruthy();
  });

  it('clicking an enabled button triggers the action.run', () => {
    const run = vi.fn();
    render(
      <Harness
        actions={[makeAction({ id: 'a', run })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    fireEvent.click(screen.getByTestId('action-bar-item-a'));
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('disabled state from evaluateEnabled reflects on the button', () => {
    render(
      <Harness
        actions={[
          makeAction({ id: 'on', enabled: () => true }),
          makeAction({ id: 'off', enabled: () => 'selection-required' }),
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const on = screen.getByTestId('action-bar-item-on') as HTMLButtonElement;
    const off = screen.getByTestId('action-bar-item-off') as HTMLButtonElement;
    expect(on.disabled).toBe(false);
    expect(off.disabled).toBe(true);
    expect(off.getAttribute('aria-disabled')).toBe('true');
  });

  it('clicking a disabled button does not invoke run', () => {
    const run = vi.fn();
    render(
      <Harness
        actions={[makeAction({ id: 'off', run, enabled: () => 'not-applicable' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    fireEvent.click(screen.getByTestId('action-bar-item-off'));
    expect(run).not.toHaveBeenCalled();
  });

  it('icons prop overrides the default action.icon for that id only', () => {
    const DefaultIcon = () => <span data-testid="default-icon-a">A</span>;
    const Custom = () => <span data-testid="custom-icon-a">★</span>;
    render(
      <Harness
        actions={[
          makeAction({ id: 'a', icon: <DefaultIcon /> }),
          makeAction({ id: 'b', icon: <span data-testid="default-icon-b">B</span> }),
        ]}
        bar={<ActionBar group="demo" icons={{ a: <Custom /> }} />}
      />,
    );
    expect(screen.getByTestId('custom-icon-a')).toBeTruthy();
    expect(screen.queryByTestId('default-icon-a')).toBeNull();
    expect(screen.getByTestId('default-icon-b')).toBeTruthy();
  });

  it('labels prop overrides aria-label and title for that id only', () => {
    render(
      <Harness
        actions={[
          makeAction({ id: 'a', label: 'Alpha' }),
          makeAction({ id: 'b', label: 'Beta' }),
        ]}
        bar={<ActionBar group="demo" labels={{ a: 'Aleph' }} />}
      />,
    );
    const a = screen.getByTestId('action-bar-item-a');
    expect(a.getAttribute('aria-label')).toBe('Aleph');
    expect(a.getAttribute('title')).toBe('Aleph');
    expect(screen.getByTestId('action-bar-item-b').getAttribute('aria-label')).toBe('Beta');
  });

  it('shortcut appears in title (in parentheses)', () => {
    render(
      <Harness
        actions={[makeAction({ id: 'a', label: 'Alpha', shortcut: 'A' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const a = screen.getByTestId('action-bar-item-a');
    expect(a.getAttribute('title')).toBe('Alpha (A)');
  });

  it('orientation="vertical" applies the vertical class', () => {
    const { container } = render(
      <Harness
        actions={[makeAction({ id: 'a' })]}
        bar={<ActionBar group="demo" orientation="vertical" />}
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(true);
  });

  it('orientation defaults to horizontal (no vertical class)', () => {
    const { container } = render(
      <Harness
        actions={[makeAction({ id: 'a' })]}
        bar={<ActionBar group="demo" />}
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(false);
  });

  it('forwards className to the toolbar root', () => {
    const { container } = render(
      <Harness
        actions={[makeAction({ id: 'a' })]}
        bar={<ActionBar group="demo" className="custom-cls" />}
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(root.classList.contains('custom-cls')).toBe(true);
  });

  it('renders nothing (empty toolbar) when no ActionsProvider is in scope', () => {
    render(<ActionBar group="demo" />);
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar.querySelectorAll('button').length).toBe(0);
  });

  it('supports a function-form icon on the Action', () => {
    render(
      <Harness
        actions={[
          makeAction({
            id: 'a',
            icon: () => <span data-testid="fn-icon">fn</span>,
          }),
        ]}
        bar={<ActionBar group="demo" />}
      />,
    );
    expect(screen.getByTestId('fn-icon')).toBeTruthy();
  });
});
