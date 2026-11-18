import { parseBmFont } from './FontAtlas';
import type { FontEntry } from './registerFont';

/** Fetch a baked atlas's metrics and image and decode them into a face. */
export async function fetchAtlasFace(metricsUrl: string, atlasUrl: string): Promise<FontEntry> {
  const [metricsRes, atlasRes] = await Promise.all([
    fetch(metricsUrl),
    fetch(atlasUrl),
  ]);

  if (!metricsRes.ok) {
    throw new Error(`HTTP ${metricsRes.status} fetching metrics from ${metricsUrl}`);
  }
  if (!atlasRes.ok) {
    throw new Error(`HTTP ${atlasRes.status} fetching atlas from ${atlasUrl}`);
  }

  const [rawJson, blob] = await Promise.all([
    metricsRes.json(),
    atlasRes.blob(),
  ]);

  const font = parseBmFont(rawJson);
  const bitmap = await createImageBitmap(blob);
  return { font, bitmap };
}
