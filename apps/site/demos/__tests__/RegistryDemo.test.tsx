import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RegistryDemo } from '../RegistryDemo';

describe('RegistryDemo', () => {
  it('opens empty again after an unmount, rather than keeping the last visit\'s entries', () => {
    const first = render(<RegistryDemo />);
    fireEvent.click(screen.getByRole('button', { name: 'push as kit' }));
    expect(screen.queryByText('Nothing registered.')).toBeNull();
    first.unmount();
    render(<RegistryDemo />);
    expect(screen.getByText('Nothing registered.')).toBeTruthy();
  });

  it('gives each mounted copy a registry of its own', () => {
    const a = render(<RegistryDemo />);
    const b = render(<RegistryDemo />);
    fireEvent.click(within(a.container).getByRole('button', { name: 'push as plugin' }));
    expect(within(b.container).getByText('Nothing registered.')).toBeTruthy();
  });
});
