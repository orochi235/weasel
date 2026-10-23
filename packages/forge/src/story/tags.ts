/** The meta tag marking a story file as a gallery: a catalog of many components, or of every permutation of one. */
export const GALLERY_TAG = 'gallery';

export function isGallery(entry: { tags?: readonly string[] }): boolean {
  return entry.tags?.includes(GALLERY_TAG) ?? false;
}

/** The meta tag marking a story file as a lab: a whole screen for exercising a component, not a specimen of it. */
export const LAB_TAG = 'lab';

export function isLab(entry: { tags?: readonly string[] }): boolean {
  return entry.tags?.includes(LAB_TAG) ?? false;
}

/** The ids among `entries` tagged as galleries and as labs, as an index page is handed them. */
export function taggedIds(entries: readonly { id: string; tags?: readonly string[] }[]): {
  galleries: string[];
  labs: string[];
} {
  return { galleries: entries.filter(isGallery).map((e) => e.id), labs: entries.filter(isLab).map((e) => e.id) };
}
