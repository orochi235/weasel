import { describe, expect, it } from 'vitest';
import { gpuReady, inQuietHours, parseProbe, parseStatus, rankForBrowser, rankForRest, usableNodes } from './fleet-nodes.mjs';
import { wantsSplit } from './fleet-parts.mjs';

const STATUS = `NAME     STATUS  LINK  GUI   CPU FREE  CORES  MEM FREE                 WORK USED          POWER  SLEEP                     JOBS       BUILD      AGE      APPS
keiei    online  -     mike   5.0/8    8      6/24G WARNING SWAP 5.2G  13.7 GiB/20.0 GiB  AC     1m +tty +wol batt:no-wol  -          1119.2109  current  Xcode
msb-uai  online  -     mike  11.3/14   14     17/36G SWAP 5.7G         23.9 GiB/40.0 GiB  AC     1m +tty +wol batt:no-wol  2 running  1119.2109  current  Xcode
orochi   online  -     mike   0.1/12   12     19/64G SWAP 12.1G        4.8 GiB/10.0 GiB   AC     1m +tty +wol batt:no-wol  1 running  1119.2109  current  Xcode
studio   online  -     mike   6.0/10   10     11/32G SWAP 1.4G         32.9 GiB/40.0 GiB  AC     never                     5 running  1119.2109  current  Xcode
teitou   offline -     mike   3.6/18   18     26/64G SWAP 6.6G         28.6 GiB/40.0 GiB  AC     never                     3 running  1119.2109  current  Xcode
  keiei refuses repo:orochi235/weasel
  msb-uai keeps quiet hours 00:00-09:00 node time
  orochi refuses rotation
`;

const at = (h: number, m = 0) => new Date(2026, 10, 19, h, m);

describe('the fleet nodes', () => {
  it('reads free cores and bars from onto status', () => {
    const nodes = parseStatus(STATUS, at(12));
    expect(nodes.map((n) => [n.name, n.free, n.cores, n.online, n.barred])).toEqual([
      ['keiei', 5, 8, true, 'refuses repo:orochi235/weasel'],
      ['msb-uai', 11.3, 14, true, ''],
      ['orochi', 0.1, 12, true, 'refuses rotation'],
      ['studio', 6, 10, true, ''],
      ['teitou', 3.6, 18, false, ''],
    ]);
    expect(usableNodes(nodes).map((n) => n.name)).toEqual(['msb-uai', 'studio']);
    expect(usableNodes(parseStatus(STATUS, at(3))).map((n) => n.name)).toEqual(['studio']);
    expect(usableNodes(nodes, { avoid: ['studio'] }).map((n) => n.name)).toEqual(['msb-uai']);
    expect(usableNodes(nodes, { minFree: 8 }).map((n) => n.name)).toEqual(['msb-uai']);
  });

  it('bars a node onto says is quiet now, the way it prints it inside the hours', () => {
    const quiet = STATUS.replace('msb-uai keeps quiet hours 00:00-09:00 node time', 'msb-uai is quiet until 09:00: it takes no new work');
    expect(parseStatus(quiet, at(12)).find((n) => n.name === 'msb-uai')?.barred).toBe('quiet until 09:00');
  });

  it('reads quiet hours that wrap past midnight', () => {
    expect(inQuietHours('22:00-06:00', at(23))).toBe(true);
    expect(inQuietHours('22:00-06:00', at(5, 59))).toBe(true);
    expect(inQuietHours('22:00-06:00', at(6))).toBe(false);
    expect(inQuietHours('00:00-09:00', at(9))).toBe(false);
  });

  it('takes a node for browser work only with an idle GPU and nobody at it', () => {
    const probe = parseProbe('"Device Utilization %"=12\n"HIDIdleTime" = 9126449151541\n');
    expect(probe).toEqual({ gpu: 12, idle: 9126 });
    expect(gpuReady(probe)).toBe(true);
    expect(gpuReady({ gpu: 44, idle: 9126 })).toBe(false);
    expect(gpuReady({ gpu: 0, idle: 6 })).toBe(false);
    expect(gpuReady({ gpu: null, idle: 9126 })).toBe(false);
    expect(gpuReady(null)).toBe(false);
    const node = (name: string, free: number) => ({ name, free, cores: 10, online: true, barred: '' });
    const ranked = rankForBrowser([
      { node: node('a', 9), reading: { gpu: 5, idle: 900 } },
      { node: node('b', 2), reading: { gpu: 0, idle: 900 } },
      { node: node('c', 9), reading: { gpu: 0, idle: 900 } },
      { node: node('d', 18), reading: { gpu: 49, idle: 900 } },
    ]);
    expect(ranked.map((n) => n.name)).toEqual(['c', 'b', 'a']);
    const rest = rankForRest([
      { node: node('a', 9), reading: { gpu: 5, idle: 900 } },
      { node: node('d', 18), reading: { gpu: 49, idle: 6 } },
      { node: node('e', 12), reading: { gpu: 49, idle: 900 } },
      { node: node('f', 20), reading: null },
    ]);
    expect(rest.map((n) => n.name)).toEqual(['e', 'a']);
  });

  it('splits the browser project off only when the plan runs it and nothing pinned the run', () => {
    const plan = 'run: node scripts/vitest-overlap.mjs run --project=core --project=browser --project=gate';
    expect(wantsSplit(plan, ['--branch', 'x'], {})).toBe(true);
    expect(wantsSplit(plan, ['--node', 'studio'], {})).toBe(false);
    expect(wantsSplit(plan, ['--spread', '0'], {})).toBe(false);
    expect(wantsSplit(plan, [], { WEASEL_FLEET_SPLIT: '0' })).toBe(false);
    expect(wantsSplit('run: npx vitest --project=core', [], {})).toBe(false);
  });
});
