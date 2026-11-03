/** Reading a V8 CPU profile from CDP's `Profiler.stop`. */

export interface ProfileNode {
  id: number;
  callFrame: { functionName: string; url: string; lineNumber: number };
  children?: number[];
}
export interface Profile { nodes: ProfileNode[]; samples: number[]; timeDeltas: number[] }

/** Self time per function, in ms, keyed `name (file:line)`. */
export function selfTimes(profile: Profile): Map<string, number> {
  const byNode = new Map<number, number>();
  for (let i = 0; i < profile.samples.length; i++) {
    const id = profile.samples[i];
    byNode.set(id, (byNode.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000);
  }
  const out = new Map<string, number>();
  for (const node of profile.nodes) {
    const ms = byNode.get(node.id);
    if (!ms) continue;
    const { functionName, url, lineNumber } = node.callFrame;
    const file = url.split('/').pop()?.split('?')[0] ?? '';
    const key = `${functionName || '(anonymous)'} (${file}:${lineNumber + 1})`;
    out.set(key, (out.get(key) ?? 0) + ms);
  }
  return out;
}
