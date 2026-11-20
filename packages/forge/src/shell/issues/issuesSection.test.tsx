import { LabContext, type LabContextValue } from '@weasel-js/labkit';
import { screen } from '@testing-library/react';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { describe, expect, it } from 'vitest';
import { indexId } from '../../story/indexPages';
import type { IndexEntry } from '../../story/types';
import { issuesSection } from './issuesSection';

const INDEX: IndexEntry[] = [
  { id: 'ui-slider--basic', title: 'ui/Slider', name: 'Basic', exportName: 'Basic', file: '/x/Slider.stories.tsx' },
];

function mount(instrumentName: string) {
  const lab = {
    instruments: [],
    trials: [{ id: 't1', instrumentName, config: {} }],
    focusedTrialId: 't1',
  } as unknown as LabContextValue;
  const section = issuesSection(INDEX);
  const body = 'item' in section && section.item && 'body' in section.item ? section.item.body : null;
  return renderWithIcons(<LabContext.Provider value={lab}>{body}</LabContext.Provider>);
}

describe('issuesSection', () => {
  it("names a story's component", () => {
    mount('ui-slider--basic');
    expect(screen.getByRole('region', { name: 'Issues' }).textContent).toContain('Slider');
  });

  it("lists the component's issues for a trial showing its index page", () => {
    mount(indexId('ui/Slider'));
    expect(screen.getByRole('region', { name: 'Issues' }).textContent).toContain('Slider');
  });
});
