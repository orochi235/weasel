import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Bar } from './Bar';

function threeButtons(roving?: boolean) {
  return render(
    <Bar label="Trial actions" roving={roving}>
      <Bar.Group aria-label="History">
        <button type="button">Undo</button>
        <button type="button">Redo</button>
      </Bar.Group>
      <Bar.Spacer />
      <button type="button">Close</button>
    </Bar>,
  );
}

describe('Bar', () => {
  test('claims the toolbar role and names its groups', () => {
    threeButtons();
    expect(screen.getByRole('toolbar', { name: 'Trial actions' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'History' })).toBeInTheDocument();
  });

  test('keeps exactly one button in the tab order', () => {
    threeButtons(true);
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === 0)).toHaveLength(1);
  });

  test('keeps one tab stop when a button becomes enabled', async () => {
    function Busy({ busy }: { busy: boolean }) {
      return (
        <Bar label="Trial actions" roving>
          <button type="button" disabled={busy}>Undo</button>
          <button type="button">Close</button>
        </Bar>
      );
    }
    const { rerender } = render(<Busy busy />);
    rerender(<Busy busy={false} />);
    await waitFor(() => {
      const inOrder = screen
        .getAllByRole<HTMLButtonElement>('button')
        .filter((b) => !b.disabled && b.tabIndex === 0);
      expect(inOrder).toHaveLength(1);
    });
  });

  test('moves focus with the arrow keys, wrapping at the end', async () => {
    const user = userEvent.setup();
    threeButtons(true);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Redo' })).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  test('leaves every button in the tab order and the arrow keys alone without roving', async () => {
    const user = userEvent.setup();
    threeButtons();
    expect(screen.getAllByRole('button').every((b) => b.tabIndex === 0)).toBe(true);
    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
  });

  test('puts every button back in the tab order when roving is turned off', () => {
    const view = threeButtons(true);
    expect(screen.getAllByRole('button').filter((b) => b.tabIndex === -1)).toHaveLength(2);
    view.rerender(
      <Bar label="Trial actions" roving={false}>
        <Bar.Group aria-label="History">
          <button type="button">Undo</button>
          <button type="button">Redo</button>
        </Bar.Group>
        <Bar.Spacer />
        <button type="button">Close</button>
      </Bar>,
    );
    expect(screen.getAllByRole('button').every((b) => b.tabIndex === 0)).toBe(true);
  });

  test('follows focus with the tab stop when roving is turned on after mount', () => {
    const view = threeButtons(false);
    view.rerender(
      <Bar label="Trial actions" roving>
        <Bar.Group aria-label="History">
          <button type="button">Undo</button>
          <button type="button">Redo</button>
        </Bar.Group>
        <Bar.Spacer />
        <button type="button">Close</button>
      </Bar>,
    );
    const close = screen.getByRole('button', { name: 'Close' });
    close.focus();
    close.blur();
    expect(close.tabIndex).toBe(0);
    expect(screen.getByRole('button', { name: 'Undo' }).tabIndex).toBe(-1);
  });

  test('sets a group apart from its neighbors with a divider, and none beside a spacer', () => {
    const { container } = render(
      <Bar label="T">
        <button type="button">A</button>
        <Bar.Group aria-label="G"><button type="button">B</button></Bar.Group>
        <Bar.Spacer />
        <Bar.Group end aria-label="H"><button type="button">C</button></Bar.Group>
      </Bar>,
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(0);
  });

  test('divides every neighbor from the next when divided', () => {
    const { container } = render(
      <Bar divided>
        <Bar.Readout>a</Bar.Readout>
        <Bar.Readout>b</Bar.Readout>
        <Bar.Spacer />
        <Bar.Readout>c</Bar.Readout>
      </Bar>,
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });

  test('opens a fragment child into its cells', () => {
    const { container } = render(
      <Bar divided>
        <>
          <Bar.Readout>a</Bar.Readout>
          <Bar.Readout>b</Bar.Readout>
        </>
      </Bar>,
    );
    expect(container.querySelectorAll('[role="separator"]')).toHaveLength(1);
  });
});

describe('a status strip', () => {
  test('is a labeled footer, not a toolbar or a live region', () => {
    const { container } = render(
      <Bar framed="status" label="Editor status"><Bar.Readout>tool: select</Bar.Readout></Bar>,
    );
    const bar = container.querySelector('footer')!;
    expect(bar.getAttribute('aria-label')).toBe('Editor status');
    // Readouts change on every pointer move; announcing them would be noise.
    expect(bar.getAttribute('role')).toBeNull();
    expect(bar.getAttribute('aria-live')).toBeNull();
  });

  test('gives a titled readout a help cursor', () => {
    render(
      <Bar framed="status">
        <Bar.Readout>plain</Bar.Readout>
        <Bar.Readout title="full detail">short</Bar.Readout>
      </Bar>,
    );
    const titled = screen.getByText('short');
    expect(titled.getAttribute('title')).toBe('full detail');
    expect(titled.className).not.toBe(screen.getByText('plain').className);
  });
});
