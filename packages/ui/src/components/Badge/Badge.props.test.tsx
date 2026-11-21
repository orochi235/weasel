import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge as="span"', () => {
  it('calls onClick on a plain badge, as it does on a removable one', () => {
    const plain = vi.fn();
    const removable = vi.fn();
    const { getByText } = render(
      <>
        <Badge as="span" onClick={plain}>a</Badge>
        <Badge as="span" onClick={removable} onRemove={() => {}} tooltip="t">b</Badge>
      </>,
    );
    fireEvent.click(getByText('a'));
    fireEvent.click(getByText('b'));
    expect(plain).toHaveBeenCalledTimes(1);
    expect(removable).toHaveBeenCalledTimes(1);
  });
});

describe('Badge focus', () => {
  it('leaves a plain removable badge unmarked while its remove control holds focus', () => {
    const { container, getByRole } = render(<Badge shape="notched" onRemove={() => {}}>tag</Badge>);
    const remove = getByRole('button', { name: 'Remove' });
    fireEvent.focus(remove);
    expect((container.firstElementChild as HTMLElement).dataset.focused).toBeUndefined();
  });

  it('marks a focusable plain badge focused', () => {
    const { container } = render(<Badge tooltip="t">tag</Badge>);
    const root = container.querySelector('[data-shape]') as HTMLElement;
    fireEvent.focus(root);
    expect(root.dataset.focused).toBe('true');
  });
});

describe('Badge labelProps', () => {
  it("keeps the caller's className and aria-label on a removable badge's label", () => {
    const { getByRole } = render(
      <Badge onClick={() => {}} onRemove={() => {}} labelProps={{ className: 'mine', 'aria-label': 'Filter: tag' }}>tag</Badge>,
    );
    const label = getByRole('button', { name: 'Filter: tag' });
    expect(label.classList.contains('mine')).toBe(true);
    expect(label.classList.length).toBe(2);
  });

  it("names the label by the badge's aria-label over labelProps'", () => {
    const { getByRole } = render(
      <Badge onClick={() => {}} onRemove={() => {}} aria-label="own" labelProps={{ 'aria-label': 'extra' }}>tag</Badge>,
    );
    expect(getByRole('button', { name: 'own' })).toBeDefined();
  });
});

describe('Badge registry keys', () => {
  it('draws a pill for a shape key that names an Object.prototype member', () => {
    const { container } = render(<Badge shape={'toString' as never}>x</Badge>);
    expect((container.firstElementChild as HTMLElement).dataset.shape).toBe('pill');
  });

  it('draws no composed outline for a base key that names an Object.prototype member', () => {
    expect(() => render(<Badge base={'constructor' as never}>x</Badge>)).not.toThrow();
  });

  it('skips an effect whose type names an Object.prototype member', () => {
    expect(() => render(<Badge base="rounded-rect" effects={[{ type: 'constructor' as never }]}>x</Badge>)).not.toThrow();
  });
});

describe('Badge mask effects', () => {
  it('masks the whole body that bloat pushes past the viewBox', () => {
    const { container } = render(<Badge base="rounded-rect" bloat={40} effects={[{ type: 'perforations' }]}>X</Badge>);
    const mask = container.querySelector('mask') as SVGMaskElement;
    expect(Number(mask.getAttribute('y'))).toBeLessThan(-10);
    expect(Number(mask.querySelector('rect')!.getAttribute('height'))).toBeGreaterThan(120);
  });
});
