/** The meta tag marking a story file as a gallery: a catalog of many components, or of every permutation of one. */
export const GALLERY_TAG = 'gallery';

export function isGallery(entry: { tags?: readonly string[] }): boolean {
  return entry.tags?.includes(GALLERY_TAG) ?? false;
}
