import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrialBody } from './TrialBody';

describe('TrialBody', () => {
  it('puts the trial’s class names on the split, its sidebar, and its content', () => {
    const { container } = render(
      <TrialBody viewport={{ w: 800, h: 600 }} sidebar={<p>side</p>} contentClassName="x">
        <p>main</p>
      </TrialBody>,
    );
    expect(container.querySelector('.lk-trial__panes.lk-split')).not.toBeNull();
    expect(container.querySelector('.lk-trial__sidebar')?.textContent).toBe('side');
    expect(container.querySelector('.lk-trial__content.x')?.textContent).toBe('main');
  });
});
