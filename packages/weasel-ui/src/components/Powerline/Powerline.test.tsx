import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Powerline } from './Powerline';

describe('Powerline', () => {
  it('renders one element per segment', () => {
    const { container } = render(
      <Powerline
        segments={[
          { text: 'a' },
          { text: 'b' },
          { text: 'c' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(3);
  });

  it('threads endCap of segment N to leftEdge of segment N+1', () => {
    const { container } = render(
      <Powerline
        startCap="flat"
        segments={[
          { text: 'a', endCap: 'chevron' },
          { text: 'b', endCap: 'slant' },
          { text: 'c' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-shape="compose"]');
    expect(badges.length).toBe(3);
  });

  it('applies row-level tone defaults but per-segment tone wins', () => {
    const { container } = render(
      <Powerline
        variant="solid"
        segments={[
          { text: 'a', tone: 'accent' },
          { text: 'b', tone: 'info' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-tone]');
    expect(badges[0].getAttribute('data-tone')).toBe('accent');
    expect(badges[1].getAttribute('data-tone')).toBe('info');
    expect(badges[0].getAttribute('data-variant')).toBe('solid');
  });

  it('renders segment text content', () => {
    const { getByText } = render(
      <Powerline segments={[{ text: 'main' }, { text: '✓ 12' }]} />
    );
    expect(getByText('main')).toBeDefined();
    expect(getByText('✓ 12')).toBeDefined();
  });

  it('accepts a custom EdgeProfile function as a cap', () => {
    const custom = (t: number, d: number) => Math.sin(t * Math.PI * 4) * d * 0.5;
    const { container } = render(
      <Powerline
        segments={[
          { text: 'x', endCap: custom },
          { text: 'y' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(2);
  });
});
