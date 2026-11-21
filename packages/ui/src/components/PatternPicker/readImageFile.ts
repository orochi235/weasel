/** A picked image, as an `image` paint stores it: a `data:` URI and the
 *  pixel size it decodes to. */
export interface ReadImage {
  src: string;
  width: number;
  height: number;
}

/** The longest side, in pixels, a raster image is stored at. A tile is shown
 *  a few hundred units across at most, and the whole document has to fit in
 *  the few megabytes an app's `localStorage` allows. */
export const MAX_STORED_IMAGE_SIDE = 1024;

function readAsDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function decode(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  return img.decode().then(() => img);
}

/** The size an SVG's `viewBox` gives it, for one declaring no width or height, which some engines decode at 0 by 0. */
async function svgViewBoxSize(file: File): Promise<{ width: number; height: number } | null> {
  if (file.type !== 'image/svg+xml') return null;
  const root = new DOMParser().parseFromString(await file.text(), 'image/svg+xml').documentElement;
  const [, , width = 0, height = 0] = (root.getAttribute('viewBox') ?? '').trim().split(/[\s,]+/).map(Number);
  return width > 0 && height > 0 ? { width, height } : null;
}

/**
 * Read `file` into what an `image` paint stores. A raster larger than
 * {@link MAX_STORED_IMAGE_SIDE} on its longest side is re-encoded smaller,
 * in its own format where the browser can write it; an SVG is kept as it is,
 * since it costs the same at any size.
 */
export async function readImageFile(file: File): Promise<ReadImage> {
  const original = await readAsDataUri(file);
  const img = await decode(original);
  const own = img.naturalWidth > 0 && img.naturalHeight > 0 ? null : await svgViewBoxSize(file);
  const width = own?.width ?? (img.naturalWidth || 1);
  const height = own?.height ?? (img.naturalHeight || 1);
  const scale = MAX_STORED_IMAGE_SIDE / Math.max(width, height);
  if (file.type === 'image/svg+xml' || scale >= 1) return { src: original, width, height };

  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h });
  const c2d = canvas.getContext('2d');
  if (!c2d) return { src: original, width, height };
  c2d.drawImage(img, 0, 0, w, h);
  const type = file.type === 'image/jpeg' || file.type === 'image/webp' ? file.type : 'image/png';
  return { src: canvas.toDataURL(type), width: w, height: h };
}
