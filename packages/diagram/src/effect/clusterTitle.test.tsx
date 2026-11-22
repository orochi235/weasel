import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClusterTitleField } from './clusterTitle';

describe('ClusterTitleField', () => {
  it('hands its text on once when the blur from its removal follows Enter before a render', () => {
    const onDone = vi.fn();
    const { getByLabelText } = render(<ClusterTitleField initial="Old" onDone={onDone} />);
    const input = getByLabelText('Group name');
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith('Old');
  });
});
