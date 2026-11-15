/**
 * What an Alt-click on a switch in a list of switches changes — a layer's visibility, an effect's on: the
 * switches in `keep` on and every other one in `states` off. When that already holds, the same click switches
 * every one back on, so a second Alt-click undoes the first. Only the switches whose value changes are returned.
 *
 * `states` holds the switches the click may change and their current values; a switch left out of it (a fixed
 * row, a layer inside the one clicked) is left alone.
 */
export function soloChanges(
  states: ReadonlyMap<string, boolean>,
  keep: ReadonlySet<string>,
): Record<string, boolean> {
  const soloed = [...states].every(([id, on]) => on === keep.has(id));
  const out: Record<string, boolean> = {};
  for (const [id, on] of states) {
    const next = soloed || keep.has(id);
    if (next !== on) out[id] = next;
  }
  return out;
}
