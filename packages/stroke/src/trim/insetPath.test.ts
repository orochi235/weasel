import { describe, expect, it } from 'vitest';
import { type Path, pathFromD, pathLengthTable } from '@weasel-js/geom';
import { insetPath } from './insetPath';

const ARC = pathFromD('M0 0C40 -60 100 -60 120 0');
const length = (d: Path) => pathLengthTable(d).total;

describe('insetPath', () => {
  it('cuts each end back by exact arc length, keeping the curve a curve', () => {
    const cut = insetPath(ARC, 5, 12)!;
    expect(length(cut)).toBeCloseTo(length(ARC) - 17, 4);
    expect(cut.kind === 'polygon' && Array.from(cut.commands)).toEqual(Array.from((ARC as { commands: Uint8Array }).commands));
  });

  it('returns the path itself with no inset, and nothing when the insets eat it', () => {
    expect(insetPath(ARC, 0, 0)).toBe(ARC);
    expect(insetPath(ARC, length(ARC) / 2, length(ARC) / 2)).toBeNull();
  });
});
