import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { CustomLayer } from './CustomLayer';
import type { CurveLayer } from './layerTypes';

describe('LayeredCurveEditor — focus without the built-in history', () => {
  it('keeps the plot in the tab order, so a layer still hears keys there', () => {
    const onInput = vi.fn();
    const layer: CurveLayer<number> = {
      id: 'counter',
      render: () => null,
      onKeyDown: (n, e, _ctx, { commit }) => { if (e.key === 'Delete') commit(n + 1); },
    };
    const { container } = render(
      <LayeredCurveEditor width={200} height={100} history={false}>
        <CustomLayer layer={layer} state={0} onInput={onInput} />
      </LayeredCurveEditor>,
    );
    const svg = container.querySelector('svg')!;
    expect(svg).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(svg, { key: 'Delete' });
    expect(onInput).toHaveBeenCalledWith(1);
  });
});
