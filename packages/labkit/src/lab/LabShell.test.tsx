import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LabShell } from './LabShell';

describe('LabShell', () => {
  test('renders title in header', () => {
    render(<LabShell title="My Lab">body</LabShell>);
    expect(screen.getByRole('heading', { name: 'My Lab' })).toBeInTheDocument();
  });

  test('renders children in body', () => {
    render(<LabShell title="t">body content</LabShell>);
    expect(screen.getByText('body content')).toBeInTheDocument();
  });

  test('renders header slot when provided', () => {
    render(
      <LabShell title="t" header={<button type="button">action</button>}>
        body
      </LabShell>,
    );
    expect(screen.getByRole('button', { name: 'action' })).toBeInTheDocument();
  });

  test('stamps the requested mode under the interstellar theme', () => {
    const { container } = render(
      <LabShell title="t" mode="light">
        x
      </LabShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-wzl-theme')).toBe('interstellar');
    expect(root.getAttribute('data-wzl-mode')).toBe('light');
  });

  test('resolves mode="auto" to a concrete mode', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-wzl-mode')).toMatch(/^(light|dark)$/);
  });

  // The overlays weasel-ui ships default to the nearest portal host, and
  // `.lk-root` is where labkit's element defaults live — not the themed
  // wrapper above it.
  test('marks lk-root as the portal host for overlays', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    expect(container.querySelector('.lk-root')?.hasAttribute('data-wzl-portal-host')).toBe(true);
  });

  test('always applies lk-root class', () => {
    const { container } = render(<LabShell title="t">x</LabShell>);
    expect(container.querySelector('.lk-root')).not.toBeNull();
  });
});
