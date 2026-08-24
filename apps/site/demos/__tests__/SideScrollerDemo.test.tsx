// apps/site/demos/__tests__/SideScrollerDemo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
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
