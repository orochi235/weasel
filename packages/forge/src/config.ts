import type { LabContribution } from '@weasel-js/labkit';
import type { ControlRenderer } from '@weasel-js/labkit/config';
import type { FrameSetup } from './frame/FrameController';

/** forge.config: what every frame applies, and what the workshop adds to the lab. */
export interface ForgeConfig {
  frame?: FrameSetup;
  shell?: {
    labChrome?: readonly LabContribution[];
    controls?: Record<string, ControlRenderer>;
  };
}

export function defineConfig(config: ForgeConfig): ForgeConfig {
  return config;
}
