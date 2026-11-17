/** The URLs each registered atlas variant was given, per family, keyed like the registry. */
const held = new Map<string, Map<string, string>>();
/** The URLs each variant's registered atlas came from, which a failed replacement falls back to. */
const landed = new Map<string, Map<string, string>>();

const pair = (metricsUrl: string, atlasUrl: string): string => `${metricsUrl}\n${atlasUrl}`;

/**
 * Hold `metricsUrl` and `atlasUrl` for one variant. Answers whether they take
 * the place of other URLs it held, which takes `replace`; without it, a
 * variant holding other URLs throws.
 */
export function claimFontUrls(
  family: string, key: string, metricsUrl: string, atlasUrl: string, replace = false,
): boolean {
  const urls = pair(metricsUrl, atlasUrl);
  const variants = held.get(family) ?? new Map<string, string>();
  const first = variants.get(key);
  if (first === urls) return false;
  if (first !== undefined && !replace) {
    const [heldMetrics, heldAtlas] = first.split('\n');
    throw new Error(
      `weasel registerFont("${family}" ${key.replace('|', '/')}): this variant is already registered with ` +
      `${heldMetrics} and ${heldAtlas}, not ${metricsUrl} and ${atlasUrl}. Register the other atlas under a ` +
      'family or variant of its own, or pass { replace: true } to swap it in.',
    );
  }
  held.set(family, variants.set(key, urls));
  return first !== undefined;
}

function holdsFontUrls(family: string, key: string, metricsUrl: string, atlasUrl: string): boolean {
  return held.get(family)?.get(key) === pair(metricsUrl, atlasUrl);
}

/**
 * Whether a variant still holds these URLs, recording that its atlas now comes
 * from them when it does: a fetch of ones since replaced lands nowhere.
 */
export function landFontUrls(family: string, key: string, metricsUrl: string, atlasUrl: string): boolean {
  if (!holdsFontUrls(family, key, metricsUrl, atlasUrl)) return false;
  landed.set(family, (landed.get(family) ?? new Map<string, string>()).set(key, pair(metricsUrl, atlasUrl)));
  return true;
}

/**
 * Let go of a variant's URLs if it still holds these, as when their fetch
 * failed and a later call may try others. A variant whose earlier atlas is
 * still registered holds that atlas's URLs again.
 */
export function releaseFontUrls(family: string, key: string, metricsUrl: string, atlasUrl: string): void {
  if (!holdsFontUrls(family, key, metricsUrl, atlasUrl)) return;
  const before = landed.get(family)?.get(key);
  if (before === undefined) held.get(family)!.delete(key);
  else held.get(family)!.set(key, before);
}

export function _clearHeldFontUrls(): void {
  held.clear();
  landed.clear();
}
