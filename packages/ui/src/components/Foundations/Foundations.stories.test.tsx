import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const { Colors } = await import('./Foundations.stories');

const style = document.createElement('style');
document.head.append(style);
const paint = (hex: string) => {
  style.textContent = `[data-wzl-theme="t"] [data-wzl-mode] { --wzl-fg: ${hex}; }`;
};

afterEach(() => {
  document.documentElement.removeAttribute('data-wzl-theme');
  document.documentElement.removeAttribute('data-wzl-variant');
});

describe('Foundations Colors story', () => {
  it('reads its values again when the theme changes', async () => {
    paint('#111111');
    document.documentElement.setAttribute('data-wzl-theme', 't');
    render(<>{Colors.render!({} as never, {} as never)}</>);
    expect(screen.getAllByText('#111111').length).toBeGreaterThan(0);
    paint('#222222');
    await act(async () => {
      document.documentElement.setAttribute('data-wzl-variant', '1');
      await Promise.resolve();
    });
    expect(screen.getAllByText('#222222').length).toBeGreaterThan(0);
  });
});
