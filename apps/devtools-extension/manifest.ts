/** The extension's `manifest.json`, one per browser family, from one source. */

export type Target = 'chrome' | 'firefox';
export const TARGETS: readonly Target[] = ['chrome', 'firefox'];

export const ICON_SIZES = [16, 32, 48, 128] as const;

/** Firefox keys an extension's storage and updates to this id. */
export const GECKO_ID = 'devtools@weasel-js.dev';

/** A browser takes up to four dot-separated integers, so a prerelease suffix is dropped. */
export function extensionVersion(kitVersion: string): string {
  return kitVersion.split(/[-+]/)[0]!;
}

export function manifestFor(target: Target, kitVersion: string): Record<string, unknown> {
  return {
    manifest_version: 3,
    name: 'weasel devtools',
    description: 'Inspect and steer the weasel canvases on a page.',
    version: extensionVersion(kitVersion),
    icons: Object.fromEntries(ICON_SIZES.map((n) => [String(n), `icons/icon-${n}.png`])),
    devtools_page: 'devtools.html',
    // `scripting` reaches tabs that loaded before the extension did.
    permissions: ['scripting'],
    host_permissions: ['<all_urls>'],
    content_scripts: [{ matches: ['<all_urls>'], js: ['content.js'], all_frames: true }],
    ...(target === 'chrome'
      ? { background: { service_worker: 'background.js' } }
      : {
          background: { scripts: ['background.js'] },
          browser_specific_settings: { gecko: { id: GECKO_ID, strict_min_version: '128.0' } },
        }),
  };
}
