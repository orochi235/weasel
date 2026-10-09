/** One step of a story's place: its label, and the tree folder it names — null for the story itself. */
export interface Crumb {
  readonly label: string;
  readonly path: string | null;
}

/** A story's place step by step: each title segment, then the story's name. An `index` segment adds nothing the
 *  one before it does not already say, so it is left out. */
export function crumbs(title: string, name: string): Crumb[] {
  const segments = title.split('/');
  const steps: Crumb[] = segments.map((label, i) => ({ label, path: segments.slice(0, i + 1).join('/') }));
  steps.push({ label: name, path: null });
  return steps.filter((step, i) => i === 0 || step.label.toLowerCase() !== 'index');
}

/** A story's place as one line. */
export function breadcrumb(title: string, name: string): string {
  return crumbs(title, name)
    .map((step) => step.label)
    .join(' > ');
}
