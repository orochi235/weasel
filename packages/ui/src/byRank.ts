/** `items` ranked by where `order` first names each one's key; anything it doesn't name sorts after, keeping its place. */
export function byRank<T>(items: readonly T[], keyOf: (item: T) => string, order: readonly string[]): T[] {
  const rank = new Map<string, number>();
  order.forEach((k, i) => { if (!rank.has(k)) rank.set(k, i); });
  const at = (item: T) => rank.get(keyOf(item)) ?? order.length;
  return items.map((item, i) => ({ item, i })).sort((a, b) => at(a.item) - at(b.item) || a.i - b.i).map((e) => e.item);
}
