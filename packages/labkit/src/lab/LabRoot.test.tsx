import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@weasel-js/theme/react';
import { describe, expect, test } from 'vitest';
import { interstellarTheme } from '../theme/interstellar';
import { LabRoot } from './LabRoot';

describe('LabRoot', () => {
  test('applies lk-root to a labkit piece mounted on its own', () => {
    const { container } = render(
      <LabRoot>
        <div>bare</div>
      </LabRoot>,
    );
    expect(container.querySelector('.lk-root')).not.toBeNull();
    expect(screen.getByText('bare')).toBeInTheDocument();
  });

  test('marks lk-root as the portal host for overlays', () => {
    const { container } = render(<LabRoot>x</LabRoot>);
    expect(container.querySelector('.lk-root')?.hasAttribute('data-wzl-portal-host')).toBe(true);
  });

  test('appends className after lk-root on the same element', () => {
    const { container } = render(<LabRoot className="lk-shell">x</LabRoot>);
    const root = container.querySelector('.lk-root') as HTMLElement;
    expect(root.className).toBe('lk-root lk-shell');
  });

  test('stamps the requested mode under the interstellar theme', () => {
    const { container } = render(<LabRoot mode="light">x</LabRoot>);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-wzl-theme')).toBe('interstellar');
    expect(root.getAttribute('data-wzl-mode')).toBe('light');
  });

  test('resolves mode="auto" to a concrete mode', () => {
    const { container } = render(<LabRoot>x</LabRoot>);
    const root = container.firstChild as HTMLElement;
    expect(root.getAttribute('data-wzl-mode')).toMatch(/^(light|dark)$/);
  });

  // The app's theme wins, and no second provider is mounted over it. This
  // only holds while labkit resolves `@weasel-js/theme` to the same copy the
  // app does — it is the in-repo half of the peer-externalization the smoke
  // test's dist audit enforces for a published install.
  test('defers to a theme the app already applied', () => {
    const { container } = render(
      <ThemeProvider theme={interstellarTheme} selection={{ mode: 'dark' }}>
        <LabRoot mode="light">x</LabRoot>
      </ThemeProvider>,
    );
    const root = container.querySelector('.lk-root') as HTMLElement;
    expect(root.getAttribute('data-wzl-mode')).toBeNull();
    expect(container.querySelectorAll('[data-wzl-theme]')).toHaveLength(1);
  });
});
