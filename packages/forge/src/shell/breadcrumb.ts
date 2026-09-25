/** A story's place as one line: each title segment, then the story's name. An `index` segment adds nothing the
 *  one before it does not already say, so it is left out. */
export function breadcrumb(title: string, name: string): string {
  const segments = [...title.split('/'), name].filter((segment, i) => i === 0 || segment.toLowerCase() !== 'index');
  return segments.join(' > ');
}
