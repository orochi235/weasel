/**
 * macOS `vmmap --summary` for this process, with mimalloc's memory under a name of its own.
 *
 * rolldown's and oxc's native bindings allocate through mimalloc, which tags the regions it maps with its `os_tag`
 * option: 100 by default, VM_MEMORY_IOACCELERATOR, so vmmap prints them as `IOAccelerator`. `retagMimalloc()` re-runs
 * the process with MIMALLOC_OS_TAG=250, one of the application-specific tags (240-255), which vmmap prints as
 * "App-Specific Tag 11" and nothing else in a Node process uses. V8 tags its own pages 255 ("App-Specific Tag 16").
 */
import { execFileSync, spawnSync } from 'node:child_process';

export const MIMALLOC_TAG = 250;
export const MIMALLOC_REGION = `App-Specific Tag ${MIMALLOC_TAG - 239}`;

/** On macOS, re-runs this script with mimalloc's tag set, unless it already is, and exits with the child's status. */
export function retagMimalloc() {
  if (process.platform !== 'darwin' || process.env.MIMALLOC_OS_TAG !== undefined) return;
  const r = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
    stdio: 'inherit', env: { ...process.env, MIMALLOC_OS_TAG: String(MIMALLOC_TAG) },
  });
  process.exit(r.status ?? 1);
}

/** vmmap's sizes (`5456K`, `1.2G`, a bare byte count) in MB. */
const sizeMB = (s) => {
  const m = /^([\d.]+)([KMG]?)$/.exec(s);
  return m ? +(Number(m[1]) * { '': 2 ** -20, K: 2 ** -10, M: 1, G: 2 ** 10 }[m[2]]).toFixed(1) : NaN;
};

/**
 * Physical footprint, and dirty MB for mimalloc's regions, V8's, and the system malloc zones, summed over a region
 * type and its `(reserved)` row. Undefined off macOS.
 */
export function nativeRegions(pid = process.pid) {
  if (process.platform !== 'darwin') return undefined;
  const text = execFileSync('vmmap', ['--summary', String(pid)], { encoding: 'utf8', maxBuffer: 2 ** 26 });
  const dirty = {};
  let inRegions = false;
  for (const line of text.split('\n')) {
    if (line.startsWith('REGION TYPE')) inRegions = true;
    else if (line.startsWith('TOTAL') || line.startsWith('MALLOC ZONE')) inRegions = false;
    const name = line.slice(0, 32).trim().replace(/ \(reserved\)$/, '');
    const cols = line.slice(32).trim().split(/\s+/);
    if (!inRegions || !name || name.startsWith('=') || cols.length < 3) continue;
    dirty[name] = +((dirty[name] ?? 0) + sizeMB(cols[2])).toFixed(1);
  }
  const footprint = /^Physical footprint:\s+(\S+)/m.exec(text)?.[1];
  const sum = (re) => +Object.entries(dirty).filter(([k]) => re.test(k)).reduce((s, [, v]) => s + v, 0).toFixed(1);
  return {
    footprintMB: footprint ? sizeMB(footprint) : undefined,
    mimallocDirtyMB: dirty[MIMALLOC_REGION] ?? 0,
    v8DirtyMB: dirty['App-Specific Tag 16'] ?? 0,
    systemMallocDirtyMB: sum(/^Malloc /),
    ioAcceleratorDirtyMB: dirty.IOAccelerator ?? 0,
  };
}
