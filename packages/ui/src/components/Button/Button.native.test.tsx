import { useState, type KeyboardEvent } from 'react';
import { describe, it, expect, expectTypeOf, vi } from 'vitest';
import { act, render, fireEvent, screen } from '@testing-library/react';
import { Button, type ButtonProps } from './Button';
import { Disabled } from '../Disabled';

describe('Button forwards the native <button> contract', () => {
  it('passes aria, focus, key, and form attributes through', () => {
    const onFocus = vi.fn();
    const onKeyDown = vi.fn();
    render(
      <Button
        aria-describedby="hint"
        aria-haspopup="dialog"
        tabIndex={-1}
        name="choice"
        value="a"
        form="elsewhere"
        title="Native title"
        data-testid="b"
        onFocus={onFocus}
        onKeyDown={onKeyDown}
      >
        Pick
      </Button>,
    );
    const btn = screen.getByTestId('b');
    expect(btn).toHaveAttribute('aria-describedby', 'hint');
    expect(btn).toHaveAttribute('aria-haspopup', 'dialog');
    expect(btn).toHaveAttribute('tabindex', '-1');
    expect(btn).toHaveAttribute('name', 'choice');
    expect(btn).toHaveAttribute('value', 'a');
    expect(btn).toHaveAttribute('form', 'elsewhere');
    expect(btn).toHaveAttribute('title', 'Native title');
    fireEvent.focus(btn);
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('keeps the attributes it writes itself over passed ones', () => {
    render(<Button pressed={false} loading className="mine" style={{ marginTop: 3 }}>Go</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn.className).toContain('mine');
    expect(btn.className).toMatch(/button/);
    expect(btn.style.marginTop).toBe('3px');
  });

  it('works as a custom disclosure trigger', () => {
    function Section() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button aria-expanded={open} aria-controls="panel" onClick={() => setOpen((o) => !o)}>Details</Button>
          <div id="panel" hidden={!open}>Body</div>
        </>
      );
    }
    render(<Section />);
    const trigger = screen.getByRole('button', { name: 'Details' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'panel');
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Body')).toBeVisible();
  });

  it('takes its place in a composite widget with a roving tabIndex', () => {
    const names = ['Left', 'Center', 'Right'];
    function Toolbar() {
      const [stop, setStop] = useState(0);
      const move = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
        if (e.key !== 'ArrowRight') return;
        const next = (i + 1) % names.length;
        setStop(next);
        (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
      };
      return (
        <div role="toolbar" aria-label="Align">
          {names.map((n, i) => (
            <Button key={n} tabIndex={i === stop ? 0 : -1} onKeyDown={move(i)}>{n}</Button>
          ))}
        </div>
      );
    }
    render(<Toolbar />);
    const [left, center, right] = names.map((name) => screen.getByRole('button', { name }));
    expect([left, center, right].map((b) => b.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    left.focus();
    fireEvent.keyDown(left, { key: 'ArrowRight' });
    expect(center).toHaveFocus();
    expect([left, center, right].map((b) => b.getAttribute('tabindex'))).toEqual(['-1', '0', '-1']);
  });

  it('submits a form it belongs to by the form attribute, with its name and value', () => {
    const submitted: { name: string | undefined; value: string | undefined }[] = [];
    render(
      <>
        <form
          id="order"
          onSubmit={(e) => {
            e.preventDefault();
            const by = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
            submitted.push({ name: by?.name, value: by?.value });
          }}
        />
        <Button type="submit" form="order" name="intent" value="save">Save</Button>
      </>,
    );
    const btn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(btn.form).toBe(document.getElementById('order'));
    fireEvent.click(btn);
    expect(submitted).toEqual([{ name: 'intent', value: 'save' }]);
  });

  it('drops press handlers and submits nothing while held for a reason, and keeps its key handlers', () => {
    const onClick = vi.fn();
    const onPointerDown = vi.fn();
    const onKeyDown = vi.fn();
    const onSubmit = vi.fn((e: { preventDefault(): void }) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Disabled reason="Nothing to save">
          <Button type="submit" onClick={onClick} onPointerDown={onPointerDown} onKeyDown={onKeyDown} tabIndex={-1}>
            Save
          </Button>
        </Disabled>
      </form>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveAttribute('aria-disabled', 'true');
    expect(btn).toHaveAttribute('tabindex', '-1');
    fireEvent.pointerDown(btn);
    fireEvent.click(btn);
    fireEvent.keyDown(btn, { key: 'ArrowRight' });
    expect(onClick).not.toHaveBeenCalled();
    expect(onPointerDown).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('is natively disabled with no reason, whatever handlers it was given', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick} aria-expanded={false}>Open</Button>);
    const btn = screen.getByRole('button', { name: 'Open' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('joins a passed aria-describedby with its tooltip description', () => {
    render(
      <>
        <span id="hint">Saves a copy</span>
        <Button aria-describedby="hint" shortcut="⌘S">Save</Button>
      </>,
    );
    const btn = screen.getByRole('button', { name: 'Save' });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => btn.focus());
    const tip = screen.getByRole('tooltip');
    expect(btn.getAttribute('aria-describedby')?.split(' ')).toEqual(expect.arrayContaining(['hint', tip.id]));
  });

  it('types its props from the native button', () => {
    expectTypeOf<ButtonProps>().toHaveProperty('aria-expanded');
    expectTypeOf<ButtonProps>().toHaveProperty('onKeyDown');
    expectTypeOf<ButtonProps>().toHaveProperty('form');
    // @ts-expect-error an icon-only button has no text, so it must be named
    void (<Button iconOnly>x</Button>);
    // `pressed` and `loading` own these; JSX lets any hyphenated name through, so the type is what says it.
    expectTypeOf<ButtonProps>().not.toHaveProperty('aria-pressed');
    expectTypeOf<ButtonProps>().not.toHaveProperty('aria-busy');
    // @ts-expect-error a native button has no `href`
    void (<Button href="/x">x</Button>);
  });
});
