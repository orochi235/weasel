// apps/site/demos/__tests__/SideScrollerDemo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { SideScrollerDemo } from '../SideScrollerDemo';

describe('SideScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SideScrollerDemo />);
    expect(screen.getAllByRole('button', { name: /enable audio|restart/i }).length).toBeGreaterThan(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('runs simulation steps without throwing', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SideScrollerDemo />);
    // Let a few animation frames drive the loop.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
      });
    }
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('mounts in an environment with no Web Audio', () => {
    expect(typeof AudioContext).toBe('undefined');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SideScrollerDemo />);
    expect(screen.getByRole('button', { name: /enable audio/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('shows the load-test readouts and the swarm control', () => {
    render(<SideScrollerDemo />);
    expect(screen.getByText(/frame/i)).toBeTruthy();
    expect(screen.getByText(/voices/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /swarm/i })).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: /collision boxes/i })).toBeTruthy();
  });
});

it('starts the run when the canvas takes focus, but not the toolbar', () => {
  const { container } = render(<SideScrollerDemo />);
  const toggle = () => screen.getByRole('button', { name: /^(start|pause)$/i });
  expect(toggle().textContent).toBe('start');

  // Focusing a toolbar button must not start it.
  fireEvent.focus(toggle());
  expect(toggle().textContent).toBe('start');

  const canvas = container.querySelector('canvas');
  expect(canvas).toBeTruthy();
  fireEvent.focus(canvas!);
  expect(toggle().textContent).toBe('pause');
});
