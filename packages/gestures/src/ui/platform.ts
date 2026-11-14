/**
 * Whether this is an Apple platform, where `mod` means the Command key and
 * not Ctrl. iPhone and iPad count: with a keyboard attached their shortcuts
 * are Command shortcuts. False where there is no `navigator`.
 *
 * The default `apple` of {@link matchModifiers}, {@link matchSpec} and `specificity`;
 * read it wherever a `mod` shortcut is drawn, so a label names the key
 * the matcher listens for.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined' || !navigator) return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  // `||`, not `??`: jsdom and some embedders report an empty-string platform.
  const raw = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(raw);
}

/** The key `mod` stands for: `'meta'` (Command) on an Apple platform, `'ctrl'` elsewhere. */
export function modKey(apple: boolean = isApplePlatform()): 'meta' | 'ctrl' {
  return apple ? 'meta' : 'ctrl';
}

/** Whether an event holds `mod`: Command on an Apple platform, Ctrl elsewhere. The other of the two is not read,
 *  so a Ctrl-click on a Mac, the secondary click there, never reads as a Command-click. */
export function modHeld(e: { metaKey: boolean; ctrlKey: boolean }, apple: boolean = isApplePlatform()): boolean {
  return apple ? e.metaKey : e.ctrlKey;
}
