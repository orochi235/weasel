import { blendFactorsOf, type BlendFactors } from '../effects/compositeOp';

/** The renderer's ordinary blend: premultiplied source over. */
export const PREMULTIPLIED: BlendFactors = blendFactorsOf('source-over');
