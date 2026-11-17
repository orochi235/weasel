/** Whether a key is seen for the first time, held to `max` keys: past that the memory is cleared,
 *  so a page that meets endless distinct names (typed ids, imported outlines) does not keep them all. */
export function firstSight(max = 256): (key: string) => boolean {
  const seen = new Set<string>();
  return (key) => {
    if (seen.has(key)) return false;
    if (seen.size >= max) seen.clear();
    seen.add(key);
    return true;
  };
}
