// apps/site/demos/__tests__/SideScrollerDemo.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SideScrollerDemo } from '../SideScrollerDemo';

describe('SideScrollerDemo', () => {
  it('mounts without throwing', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SideScrollerDemo />);
    expect(screen.getByRole('button', { name: /enable audio|restart/i })).toBeTruthy();
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
