import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { lineShape } from '@weasel-js/geom';
import { ToolGroup } from '../ToolGroup';
import { RunScope, STRAIGHT_RUN, useRun, type Run } from './run';

afterEach(cleanup);

function probe(): { seen: () => Run; Probe: () => null } {
  let seen: Run | undefined;
  return { seen: () => seen!, Probe: () => { seen = useRun(); return null; } };
}

describe('RunScope', () => {
  it('is a straight horizontal run outside every scope', () => {
    const p = probe();
    render(<p.Probe />);
    expect(p.seen()).toEqual(STRAIGHT_RUN);
  });

  it('keeps each field of the enclosing run that it does not set', () => {
    const p = probe();
    const shape = lineShape({ x: 0, y: 0 }, { x: 100, y: 0 });
    render(
      <RunScope orientation="vertical" shape={shape} align="start">
        <RunScope side="left"><p.Probe /></RunScope>
      </RunScope>,
    );
    expect(p.seen()).toEqual({ orientation: 'vertical', shape, align: 'start', side: 'left' });
  });

  it('starts over from a straight run when fresh', () => {
    const p = probe();
    render(
      <RunScope orientation="vertical" side="left">
        <RunScope fresh align="end"><p.Probe /></RunScope>
      </RunScope>,
    );
    expect(p.seen()).toEqual({ ...STRAIGHT_RUN, align: 'end' });
  });
});

describe('ToolGroup', () => {
  it('lays its buttons along the run it sits in', () => {
    render(
      <>
        <ToolGroup aria-label="row"><span /></ToolGroup>
        <RunScope orientation="vertical"><ToolGroup aria-label="column"><span /></ToolGroup></RunScope>
      </>,
    );
    expect(screen.getByRole('group', { name: 'row' }).className).toMatch(/horizontal/);
    expect(screen.getByRole('group', { name: 'column' }).className).not.toMatch(/horizontal/);
  });
});
