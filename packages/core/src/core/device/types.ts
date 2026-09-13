/**
 * `DeviceProfile` is declared in `@weasel-js/routing` — the eligibility rules
 * that read `coarsePointer` / `canHover` live there, and keeping the
 * declaration beside them is what lets that package build without core.
 *
 * Re-exported here so core's own call sites keep importing from
 * `core/device/types`, where they have always looked.
 */
import type { DeviceProfile, DetectedDeviceFacts } from '@weasel-js/routing';
export type { DeviceProfile, DetectedDeviceFacts };
