import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { hostTextEditorHolds } from '../../../../packages/text-tools/src/editor/hostTextEditors';
import { TextDemo } from '../TextDemo';

describe('TextDemo', () => {
  it('claims its canvas for its own text editor from the first render', () => {
    const { container } = render(<TextDemo />);
    expect(hostTextEditorHolds(container.querySelector('canvas')!)).toBe(true);
  });
});
