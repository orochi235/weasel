import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useAttachRef } from './useAttachRef';

describe('useAttachRef', () => {
  it('runs the cleanup when its element unmounts, and when another element takes its place', () => {
    const detach = vi.fn();
    const attach = vi.fn((_el: Element) => detach);
    function Box({ tag }: { tag: 'div' | 'span' }) {
      const ref = useAttachRef(attach);
      return tag === 'div' ? <div ref={ref} /> : <span ref={ref} />;
    }
    const view = render(<Box tag="div" />);
    expect(attach).toHaveBeenCalledTimes(1);
    view.rerender(<Box tag="span" />);
    expect(detach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledTimes(2);
    view.unmount();
    expect(detach).toHaveBeenCalledTimes(2);
  });
});
