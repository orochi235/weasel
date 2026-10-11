/**
 * Whether this is an Apple platform, where `mod` means the Command key and
 * not Ctrl. iPhone and iPad count: with a keyboard attached their shortcuts
 * are Command shortcuts. False where there is no `navigator`.
 *
 * Pass the answer to {@link matchModifiers} / {@link matchSpec} as `isMac`,
 * and read it wherever a `mod` shortcut is drawn, so a label names the key
 * the matcher listens for.
 */
export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined' || !navigator) return false;
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  // `||`, not `??`: jsdom and some embedders report an empty-string platform.
  const raw = nav.userAgentData?.platform || nav.platform || nav.userAgent || '';
  return /mac|iphone|ipad|ipod/i.test(raw);
}
