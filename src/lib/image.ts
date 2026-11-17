import type { ExtractedPalette } from '@/types';

interface Pixel {
  r: number;
  g: number;
  b: number;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That image could not be loaded.'));
    img.src = src;
  });

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;

const luminance = (p: Pixel): number => (0.2126 * p.r + 0.7152 * p.g + 0.0722 * p.b) / 255;

const saturation = (p: Pixel): number => {
  const max = Math.max(p.r, p.g, p.b);
  const min = Math.min(p.r, p.g, p.b);
  return max === 0 ? 0 : (max - min) / max;
};

const distance = (a: Pixel, b: Pixel): number =>
  Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);

const mix = (a: Pixel, b: Pixel, weight = 0.5): Pixel => ({
  r: a.r * (1 - weight) + b.r * weight,
  g: a.g * (1 - weight) + b.g * weight,
  b: a.b * (1 - weight) + b.b * weight,
});

const kmeans = (pixels: Pixel[], k: number, iterations = 12): Pixel[] => {
  if (pixels.length === 0) return [];
  const centroids: Pixel[] = [];
  const stride = Math.max(1, Math.floor(pixels.length / k));
  for (let i = 0; i < k; i += 1) {
    centroids.push({ ...pixels[Math.min(pixels.length - 1, i * stride)] });
  }

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const buckets: Pixel[][] = Array.from({ length: k }, () => []);
    pixels.forEach((pixel) => {
      let nearest = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      centroids.forEach((centroid, index) => {
        const dist = distance(pixel, centroid);
        if (dist < nearestDistance) {
          nearestDistance = dist;
          nearest = index;
        }
      });
      buckets[nearest].push(pixel);
    });
    centroids.forEach((centroid, index) => {
      const bucket = buckets[index];
      if (bucket.length === 0) return;
      const sum = bucket.reduce(
        (acc, p) => ({ r: acc.r + p.r, g: acc.g + p.g, b: acc.b + p.b }),
        { r: 0, g: 0, b: 0 },
      );
      centroid.r = sum.r / bucket.length;
      centroid.g = sum.g / bucket.length;
      centroid.b = sum.b / bucket.length;
    });
  }
  return centroids;
};

export interface ReferenceAnalysis {
  palette: ExtractedPalette;
  appearance: 'dark' | 'light';
  brightness: number;
  dominant: string;
}

export const analyzeReferenceImage = async (dataUrl: string): Promise<ReferenceAnalysis> => {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const size = 96;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas is unavailable in this browser.');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const pixels: Pixel[] = [];
  let totalLum = 0;
  let count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha < 128) continue;
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] };
    const lum = luminance(pixel);
    totalLum += lum;
    count += 1;
    if (lum < 0.03 || lum > 0.985) continue;
    pixels.push(pixel);
  }

  const brightness = count > 0 ? totalLum / count : 0.5;
  if (pixels.length === 0) {
    return {
      palette: { accent: '#E8CD9A', secondary: '#B6A8E8', background: '#0D1020', muted: '#6B6480' },
      appearance: brightness > 0.55 ? 'light' : 'dark',
      brightness,
      dominant: '#0D1020',
    };
  }

  const centroids = kmeans(pixels, 5, 10);
  const scored = centroids
    .map((centroid) => ({
      color: centroid,
      lum: luminance(centroid),
      sat: saturation(centroid),
    }))
    .sort((a, b) => b.sat * 0.75 + b.lum * 0.25 - (a.sat * 0.75 + a.lum * 0.25));

  const vivid = scored.find((c) => c.sat > 0.18 && c.lum > 0.22) ?? scored[0];
  const second =
    scored.find(
      (c) => distance(c.color, vivid.color) > 58 && c.lum > 0.16 && c !== vivid,
    ) ?? scored[1] ?? vivid;
  const darkest = scored.slice().sort((a, b) => a.lum - b.lum)[0];
  const lightest = scored.slice().sort((a, b) => b.lum - a.lum)[0];

  const background =
    brightness > 0.62
      ? mix(lightest.color, { r: 250, g: 246, b: 238 }, 0.55)
      : mix(darkest.color, { r: 9, g: 11, b: 22 }, 0.5);
  const muted = mix(background, vivid.color, 0.42);

  return {
    palette: {
      accent: rgbToHex(vivid.color.r, vivid.color.g, vivid.color.b),
      secondary: rgbToHex(second.color.r, second.color.g, second.color.b),
      background: rgbToHex(background.r, background.g, background.b),
      muted: rgbToHex(muted.r, muted.g, muted.b),
    },
    appearance: brightness > 0.62 ? 'light' : 'dark',
    brightness,
    dominant: rgbToHex(darkest.color.r, darkest.color.g, darkest.color.b),
  };
};

export const createThumbnail = (source: string, width = 260): Promise<string> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = width / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.onerror = () => reject(new Error('Thumbnail failed'));
    img.src = source;
  });
