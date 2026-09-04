import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineRange } from './InlineRange/InlineRange';
import shared from './range.module.css';

// CSS modules are not processed in the `weasel-ui` vitest project, so these
// assert the contract — that the shared class is applied — not the pixels.
// The look is checked by screenshot.
describe('shared range skin', () => {
  it('InlineRange wears the shared range class', () => {
    const { container } = render(<InlineRange value={50} onChange={() => {}} />);
    const input = container.querySelector('input[type="range"]');
    expect(input).not.toBeNull();
    expect(input?.className.split(' ')).toContain(shared.range);
  });

  it('InlineRange keeps a caller className alongside it', () => {
    const { container } = render(
      <InlineRange value={50} className="mine" onChange={() => {}} />,
    );
    const cls = container.querySelector('input[type="range"]')?.className.split(' ') ?? [];
    expect(cls).toContain(shared.range);
    expect(cls).toContain('mine');
  });

  it('SliderRow wears the shared range class', async () => {
    const { SliderRow } = await import('./Properties/PropertyPanel');
    const { container } = render(
      <SliderRow label="Bevel" value={5} min={0} max={10} step={1} onChange={() => {}} />,
    );
    const input = container.querySelector('input[type="range"]');
    expect(input?.className.split(' ')).toContain(shared.range);
  });

  it('ColorRow alpha wears the shared range and alpha classes', async () => {
    const { ColorRow } = await import('./Properties/PropertyPanel');
    const { container } = render(
      <ColorRow label="Fill" value="#3b82f6" alpha={1} onChange={() => {}} onAlphaChange={() => {}} />,
    );
    const cls = container.querySelector('input[type="range"]')?.className.split(' ') ?? [];
    expect(cls).toContain(shared.range);
    expect(cls).toContain(shared.alpha);
  });

  it('a disabled alpha track stays disabled on the input', async () => {
    // The inert treatment is keyed off :disabled in the shared module, so the
    // prop has to keep reaching the element and not only the row's class.
    const { ColorRow } = await import('./Properties/PropertyPanel');
    const { container } = render(
      <ColorRow
        label="Fill"
        value="#3b82f6"
        alpha={1}
        alphaDisabled
        onChange={() => {}}
        onAlphaChange={() => {}}
      />,
    );
    expect(container.querySelector('input[type="range"]')).toBeDisabled();
  });
});
