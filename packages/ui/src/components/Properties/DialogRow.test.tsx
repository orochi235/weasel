import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { DialogRow } from './DialogRow';

describe('DialogRow', () => {
  it('shows the summary on a button and keeps the body unmounted while closed', () => {
    let mounted = 0;
    function Body() {
      mounted++;
      return <p>body</p>;
    }
    render(
      <DialogRow label="Globs" summary="a, b">
        {() => <Body />}
      </DialogRow>,
    );
    expect(screen.getByRole('button', { name: 'Edit Globs' }).textContent).toContain('a, b');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mounted).toBe(0);
  });

  it('opens the body in a dialog titled by the label, and Done closes it', () => {
    render(
      <DialogRow label="Globs" summary="a">
        {() => <p>body</p>}
      </DialogRow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit Globs' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Globs' })).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('hands a function body close, and lets it use hooks', () => {
    function Body({ close }: { close: () => void }) {
      const [n, setN] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setN(n + 1)}>
            count {n}
          </button>
          <button type="button" onClick={close}>
            apply
          </button>
        </>
      );
    }
    render(
      <DialogRow label="X" summary="-" footer={null}>
        {(close) => <Body close={close} />}
      </DialogRow>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit X' }));
    fireEvent.click(screen.getByRole('button', { name: 'count 0' }));
    expect(screen.getByRole('button', { name: 'count 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'apply' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
