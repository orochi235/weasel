/**
 * `@weasel-js/text-tools/presets`: text-tools' feature presets under short names, for `<SceneCanvas features>`:
 *
 * ```tsx
 * import * as presets from '@weasel-js/editing/presets';
 * import * as textTools from '@weasel-js/text-tools/presets';
 * <SceneCanvas features={[presets.draw, textTools.text, textTools.textTools]} />
 * ```
 *
 * `createTextPreset` and `createTextToolsPreset`, on the main entry, build either with options.
 *
 * @packageDocumentation
 */
export { textPreset as text, textToolsPreset as textTools, whiteboardPreset as whiteboard } from './featurePresets';
