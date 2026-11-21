import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { trigger } from './selectRow';

describe('trigger', () => {
  it('matches a label holding regex syntax as written', () => {
    render(<button type="button">Large Size (px)</button>);
    expect(trigger('Size (px)').textContent).toBe('Large Size (px)');
  });

  it('matches the label at the end of the name, not a longer label or a help button', () => {
    render(
      <>
        <button type="button">A Mode</button>
        <button type="button">B Mode select</button>
        <button type="button">C Submode</button>
        <button type="button">About Mode</button>
      </>,
    );
    expect(trigger('Mode').textContent).toBe('A Mode');
  });
});
