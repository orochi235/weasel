import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createToolOptionValues, defineTool } from '@weasel-js/core';
import { KNEAD_TOOL_OPTIONS } from '@weasel-js/path-tools';
import { renderWithIcons } from '../../testIcons';
import { ActiveToolOptions } from './ActiveToolOptions';

const brush = defineTool({ id: 'knead', options: KNEAD_TOOL_OPTIONS, presentation: { label: 'Knead' } });

describe('ActiveToolOptions', () => {
  it("draws the active tool's options, and writes a change to where the host keeps them", () => {
    const values = createToolOptionValues();
    renderWithIcons(<ActiveToolOptions tool={brush} values={values} />);
    expect(screen.getByRole('toolbar', { name: 'Knead' })).toBeInTheDocument();
    const size = screen.getByRole('slider', { name: /Size/ });
    act(() => { fireEvent.change(size, { target: { value: '41' } }); });
    expect(values.get('knead').radiusPx).toBe(41);
    expect(screen.getByRole('slider', { name: /Strength/ })).toBeInTheDocument();
  });

  it('follows a step made elsewhere, such as a key', () => {
    const values = createToolOptionValues();
    renderWithIcons(<ActiveToolOptions tool={brush} values={values} />);
    act(() => values.set('knead', 'radiusPx', 80));
    expect(screen.getByRole('slider', { name: /Size/ })).toHaveValue('80');
  });

  it('draws nothing for a tool with no options', () => {
    const { container } = renderWithIcons(<ActiveToolOptions tool={defineTool({ id: 'select' })} values={createToolOptionValues()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
