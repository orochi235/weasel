/** Every image pattern's texture id starts with this, followed by the picture's `src`. */
export const IMAGE_PATTERN_ID_PREFIX = 'image:';

/** The texture id an image pattern of `src` draws through. */
export const imagePatternTextureId = (src: string): string => IMAGE_PATTERN_ID_PREFIX + src;
