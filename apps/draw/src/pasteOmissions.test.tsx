import { act, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultToastQueue, ToastRegion } from '@weasel-js/ui/components/Toast';
import { describePasteOmissions, reportPasteOmissions } from './pasteOmissions';
import { renderWithIcons } from './testIcons';

afterEach(() => act(() => defaultToastQueue.clear()));

describe('describePasteOmissions', () => {
  it('counts one shape in the singular', () => {
    expect(describePasteOmissions([{ id: 'e', reason: 'dependency-not-copied', missing: ['a'] }]).title)
      .toBe('1 shape was not pasted');
  });

  it('counts several in the plural, and gives each reason once', () => {
    const { title, description } = describePasteOmissions([
      { id: 'e1', reason: 'dependency-not-copied', missing: ['a'] },
      { id: 'e2', reason: 'dependency-not-copied', missing: ['b'] },
      { id: 'c', reason: 'container-not-pasted' },
    ]);
    expect(title).toBe('3 shapes were not pasted');
    expect(description).toBe(
      'A shape that follows other shapes needs them copied with it. A shape inside one that was left out is left out too.',
    );
  });

  it('has a sentence for a derivation this document cannot run', () => {
    expect(describePasteOmissions([{ id: 'd', reason: 'derivation-not-registered' }]).description)
      .toBe('A shape built from other shapes cannot be rebuilt in this document.');
  });
});

describe('reportPasteOmissions', () => {
  it('shows one warning toast, replaced by the next paste', () => {
    renderWithIcons(<ToastRegion />);
    act(() => reportPasteOmissions([{ id: 'e', reason: 'dependency-not-copied', missing: ['a'] }]));
    expect(screen.getByText('1 shape was not pasted')).toBeInTheDocument();
    act(() => reportPasteOmissions([
      { id: 'e', reason: 'dependency-not-copied', missing: ['a'] },
      { id: 'f', reason: 'dependency-not-copied', missing: ['a'] },
    ]));
    expect(screen.queryByText('1 shape was not pasted')).toBeNull();
    expect(screen.getByText('2 shapes were not pasted')).toBeInTheDocument();
  });
});
