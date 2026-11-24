/** A React key per item, by its name, with a repeated name told apart by how many times it came before. */
export function repeatKeys<T>(items: readonly T[], nameOf: (item: T) => string): string[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const name = nameOf(item);
    const n = seen.get(name) ?? 0;
    seen.set(name, n + 1);
    return `${n}:${name}`;
  });
}
