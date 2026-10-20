import type { AnalyserTap } from '@weasel-js/audio';
import { PREVIEW_DENSITY } from '../draw';

/** What a stage's preview slot shows while its graph plays. */
export type AudioPreview = 'off' | 'scope' | 'spectrum';

// Neutral enough to read on both the light and the dark theme; no image preview names a foreground to match.
const INK = '#8a8f98';
const BANDS = 32;
const LINE = 1.5;

type Size = { width: number; height: number };

function canvasOf(size: Size) {
  const canvas = new OffscreenCanvas(
    Math.max(1, Math.round(size.width * PREVIEW_DENSITY)),
    Math.max(1, Math.round(size.height * PREVIEW_DENSITY)),
  );
  return { canvas, g: canvas.getContext('2d')!, w: canvas.width, h: canvas.height };
}

/** The waveform as a line across the bitmap, silence at mid-height. */
export function drawScope(tap: AnalyserTap, size: Size): ImageBitmap {
  const { canvas, g, w, h } = canvasOf(size);
  const wave = tap.waveform();
  g.strokeStyle = INK;
  g.lineWidth = LINE * PREVIEW_DENSITY;
  g.lineJoin = 'round';
  g.beginPath();
  for (let x = 0; x < w; x += 1) {
    const v = wave[Math.min(wave.length - 1, Math.floor((x / Math.max(1, w - 1)) * (wave.length - 1)))]! / 255;
    const y = h - v * h;
    if (x === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  return canvas.transferToImageBitmap();
}

/** The spectrum as filled bars rising from the bottom, low frequencies on the left. */
export function drawSpectrum(tap: AnalyserTap, size: Size): ImageBitmap {
  const { canvas, g, w, h } = canvasOf(size);
  const bands = tap.bands(BANDS);
  const slot = w / BANDS;
  g.fillStyle = INK;
  for (let i = 0; i < BANDS; i += 1) {
    const bar = bands[i]! * h;
    g.fillRect(i * slot, h - bar, slot * 0.8, bar);
  }
  return canvas.transferToImageBitmap();
}
