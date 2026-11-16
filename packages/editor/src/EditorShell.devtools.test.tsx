import { cleanup, screen } from '@testing-library/react';
import { AmbientContributionsProvider, useProvidedAmbient } from '@weasel-js/core';
import { devtoolsOff, lazyDevtools } from '@weasel-js/devtools/mount';
import { renderWithIcons as render } from '@weasel-js/ui/testing/withIcons';
import { afterEach, describe, expect, it } from 'vitest';
import { EditorShell } from './EditorShell';

afterEach(() => cleanup());

/** What a canvas in the shell would take as its `devtools` entry. */
function Taken() {
  const entry = useProvidedAmbient().find((e) => e.id === 'devtools');
  const shown = entry === lazyDevtools ? 'on' : entry ? 'withheld' : 'none';
  return <output aria-label="devtools">{shown}</output>;
}

const OFF = [devtoolsOff];
const taken = () => screen.getByLabelText('devtools').textContent;

describe('EditorShell and devtools', () => {
  it('gives its canvases devtools in a development build', () => {
    render(<EditorShell><Taken /></EditorShell>);
    expect(taken()).toBe('on');
  });

  it('withholds it given devtools={false}', () => {
    render(<EditorShell devtools={false}><Taken /></EditorShell>);
    expect(taken()).toBe('withheld');
  });

  it('withholds it under a provided devtoolsOff', () => {
    render(
      <AmbientContributionsProvider contributions={OFF}>
        <EditorShell><Taken /></EditorShell>
      </AmbientContributionsProvider>,
    );
    expect(taken()).toBe('withheld');
  });
});
