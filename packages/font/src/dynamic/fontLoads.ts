/**
 * The document's font loads, as family names. A canvas draws a family whose
 * web font is still loading in a fallback face and reports nothing when the
 * real one lands, so whatever measured through a canvas has to hear it here.
 */

/** A family name as two spellings of it compare: unquoted, lower case. */
export function familyKey(family: string): string {
  return family.trim().replace(/^(["'])(.*)\1$/, '$2').toLowerCase();
}

/**
 * Call `onLoaded` with the families of each batch of faces `document.fonts`
 * finishes loading. Returns a function that stops it. Does nothing where
 * there is no font set to listen to.
 *
 * A face loaded before it is added to the set is never announced.
 */
export function watchFontLoads(onLoaded: (families: string[]) => void): () => void {
  const fonts = typeof document === 'undefined' ? undefined : document.fonts;
  if (!fonts?.addEventListener) return () => {};
  const listener = (event: Event): void => {
    const faces = (event as Partial<FontFaceSetLoadEvent>).fontfaces ?? [];
    if (faces.length > 0) onLoaded(faces.map((face) => face.family));
  };
  fonts.addEventListener('loadingdone', listener);
  return () => fonts.removeEventListener('loadingdone', listener);
}
