import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PrefKindBadge } from './PrefKindBadge';
import s from './PrefKindBadge.module.css';

afterEach(cleanup);

describe('PrefKindBadge', () => {
  it('colors a built-in kind from its own class', () => {
    render(<PrefKindBadge kind="number" />);
    const badge = screen.getByText('number').closest('[data-status]')!;
    expect(badge.getAttribute('data-status')).toBe('custom');
    expect(badge.classList.contains(s.number!)).toBe(true);
  });

  it('draws a custom kind or a group muted and outlined', () => {
    render(<><PrefKindBadge kind="registry-enum" /><PrefKindBadge kind="group" /></>);
    for (const word of ['registry-enum', 'group']) {
      const badge = screen.getByText(word).closest('[data-status]')!;
      expect(badge.getAttribute('data-status')).toBe('muted');
      expect(badge.getAttribute('data-variant')).toBe('outline');
    }
  });

  it('does not mistake an Object.prototype name for a kind', () => {
    render(<PrefKindBadge kind="toString" />);
    expect(screen.getByText('toString').closest('[data-status]')!.getAttribute('data-status')).toBe('muted');
  });
});
