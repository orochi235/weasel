import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PoseBlendDemo } from '../PoseBlendDemo';

afterEach(cleanup);

describe('PoseBlendDemo', () => {
  it('starts a second move, and a spring, over one still running without throwing', () => {
    const { container } = render(<PoseBlendDemo />);
    act(() => { fireEvent.click(screen.getByText('bottom right')); });
    act(() => { fireEvent.click(screen.getByText('top right')); });
    act(() => { fireEvent.click(screen.getByLabelText('spring')); });
    act(() => { fireEvent.click(screen.getByText('bottom left')); });
    expect(container.querySelector('canvas')).not.toBeNull();
  });
});
