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
});
