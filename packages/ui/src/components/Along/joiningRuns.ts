import { JOINING_RUNS } from './joiningTypes.gen';

type JoiningType = 'D' | 'R' | 'L' | 'C' | 'T' | 'U';

const ZWNJ = '‌';
const TRANSPARENT = /^[\p{Mn}\p{Me}\p{Cf}]/u;

let table: Map<number, JoiningType> | null = null;

function joiningTypeOf(grapheme: string): JoiningType {
  if (!table) {
    table = new Map();
    for (const run of JOINING_RUNS.split(',')) {
      const [start, rest] = run.split('.') as [string, string];
      const from = parseInt(start, 36);
      const length = parseInt(rest.slice(0, -1), 36);
      for (let cp = from; cp < from + length; cp++) table.set(cp, rest.at(-1) as JoiningType);
    }
  }
  return table.get(grapheme.codePointAt(0)!) ?? (TRANSPARENT.test(grapheme) ? 'T' : 'U');
}

const joinsBack = (t: JoiningType | undefined) => t === 'D' || t === 'R' || t === 'C';
const joinsAhead = (t: JoiningType | undefined) => t === 'D' || t === 'L' || t === 'C';

/**
 * `graphemes`, in logical order, with each stretch whose letters join one another merged into one string: the runs
 * of Arabic, Syriac, N'Ko, Mongolian and the other joining scripts that have to be shaped together to take their
 * joined forms. A grapheme holding a zero-width non-joiner ends its run, and a lone mark stays with what precedes it.
 */
export function joiningRuns(graphemes: readonly string[]): string[] {
  const types = graphemes.map(joiningTypeOf);
  const solid = (i: number, step: 1 | -1): number => {
    let j = i;
    while (types[j] === 'T') j += step;
    return j;
  };
  const joined = (i: number): boolean => {
    if (types[i + 1] === 'T') return true;
    const a = solid(i, -1);
    const b = solid(i + 1, 1);
    return joinsAhead(types[a]) && joinsBack(types[b]) && !graphemes[a]!.includes(ZWNJ);
  };
  const runs: string[] = [];
  let run = '';
  graphemes.forEach((g, i) => {
    run += g;
    if (i === graphemes.length - 1 || !joined(i)) {
      runs.push(run);
      run = '';
    }
  });
  return runs;
}
