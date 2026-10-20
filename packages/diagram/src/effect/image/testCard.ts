const BARS = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];

/** A test card of `size` (a square's side, or a width and height): color bars
 *  over a gray ramp, with a white ring in the middle, so every stage has edges,
 *  hues, and levels to work on. */
export function testCard(size: number | { width: number; height: number }): ImageBitmap {
  const { width, height } = typeof size === 'number' ? { width: size, height: size } : size;
  const canvas = new OffscreenCanvas(width, height);
  const g = canvas.getContext('2d')!;
  const barHeight = height * 0.7;
  BARS.forEach((color, i) => {
    g.fillStyle = color;
    const x = Math.floor((i * width) / BARS.length);
    g.fillRect(x, 0, Math.ceil(width / BARS.length) + 1, barHeight);
  });
  const ramp = g.createLinearGradient(0, 0, width, 0);
  ramp.addColorStop(0, '#000');
  ramp.addColorStop(1, '#fff');
  g.fillStyle = ramp;
  g.fillRect(0, barHeight, width, height - barHeight);
  g.strokeStyle = '#fff';
  g.lineWidth = Math.max(1, Math.min(width, height) / 32);
  g.beginPath();
  g.arc(width / 2, height / 2, Math.min(width, height) * 0.3, 0, Math.PI * 2);
  g.stroke();
  return canvas.transferToImageBitmap();
}
