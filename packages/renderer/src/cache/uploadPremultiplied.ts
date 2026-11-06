import type { GpuImageSource } from '../gpu/types';

/** A texture source the browser decodes. An image texture's texels are
 *  premultiplied on upload: what samples one divides the alpha back out before
 *  any color math (`STRAIGHT_RGB_GLSL`). */
export type ImageTexSource = GpuImageSource;
