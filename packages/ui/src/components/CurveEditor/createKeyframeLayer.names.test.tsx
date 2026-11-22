import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { keyframeLayerState } from './createKeyframeLayer';
import { LayeredCurveEditor } from './LayeredCurveEditor';
import { KeyframeLayer } from './KeyframeLayer';

describe('createKeyframeLayer — default accessible names', () => {
  it('names each key and segment apart on a [0, 1] range', () => {
    const state = keyframeLayerState([{ t: 0, value: 0 }, { t: 0.3, value: 1 }, { t: 0.6, value: 0 }, { t: 1, value: 1 }]);
    render(<LayeredCurveEditor width={200} height={100}><KeyframeLayer state={state} /></LayeredCurveEditor>);
    for (const t of ['0', '0.3', '0.6', '1']) expect(screen.getByRole('button', { name: `Curve key at ${t}` })).toBeInTheDocument();
    for (const t of ['0.3', '0.6', '1']) expect(screen.getByRole('button', { name: `Curve segment into ${t}` })).toBeInTheDocument();
  });
});
