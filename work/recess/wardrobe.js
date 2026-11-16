'use strict';

const FABRICS = {
  mint: { shade: [24, 74, 58], light: [133, 239, 186], seam: [204, 255, 222] },
  indigo: { shade: [23, 33, 89], light: [111, 142, 223], seam: [153, 185, 244] },
  violet: { shade: [59, 32, 100], light: [188, 144, 251], seam: [224, 197, 255] },
  crimson: { shade: [90, 21, 42], light: [240, 109, 117], seam: [255, 189, 142] },
  orange: { shade: [119, 49, 21], light: [253, 175, 74], seam: [255, 212, 112] },
  graphite: { shade: [37, 31, 54], light: [145, 143, 174], seam: [189, 187, 217] },
  forest: { shade: [26, 63, 30], light: [143, 200, 82], seam: [198, 228, 110] },
  pink: { shade: [102, 39, 76], light: [247, 142, 195], seam: [255, 191, 211] },
  sky: { shade: [27, 57, 113], light: [107, 208, 244], seam: [169, 235, 251] },
};
const CLOTHING_SLOTS = ['top', 'bottom', 'bag', 'shoes'];
const displayedOutfits = new WeakMap();
const wardrobePixels = new Map();
const wardrobeFrames = new Map();

function readPixels(source) {
  if (wardrobePixels.has(source)) return wardrobePixels.get(source);
  const image = new Image();
  image.src = source;
  const decode = image.decode().then(() => {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, image.width, image.height);
  });
  wardrobePixels.set(source, decode);
  return decode;
}

function urlValue(value) {
  return value.trim().match(/^url\(['"]?(.*?)['"]?\)$/)?.[1];
}

function recolorClothes(base, mask, fabrics) {
  const image = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
  const pixels = image.data;
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const red = mask.data[offset];
    const green = mask.data[offset + 1];
    const blue = mask.data[offset + 2];
    const slot = red ? (green ? 3 : 0) : green ? 1 : blue ? 2 : -1;
    const fabric = fabrics[slot];
    if (!fabric) continue;
    const light = (pixels[offset] * 0.25 + pixels[offset + 1] * 0.6 + pixels[offset + 2] * 0.15) / 255;
    const tone = Math.min(1, Math.max(0.06, (light - 0.07) * (slot === 0 ? 1.55 : 1.22)));
    const index = offset / 4;
    const y = Math.floor(index / base.width);
    const x = index % base.width;
    const seam = slot === 0 && tone > 0.40 && (y + Math.floor(x / 4)) % 31 < 3;
    for (let channel = 0; channel < 3; channel++) {
      const color = fabric.shade[channel] + (fabric.light[channel] - fabric.shade[channel]) * tone;
      pixels[offset + channel] = seam ? color * 0.61 + fabric.seam[channel] * 0.39 : color;
    }
  }
  return image;
}

function renderOutfit(sprite, equipped) {
  const styles = CLOTHING_SLOTS.map(slot => GEAR[equipped[slot]]?.style || '');
  const key = [sprite.dataset.sprite, sprite.dataset.pose, ...styles].join(':');
  if (displayedOutfits.get(sprite) === key) return;
  displayedOutfits.set(sprite, key);
  const active = styles.some(Boolean);
  sprite.dataset.outfit = active ? styles.map(style => style || 'basic').join(' ') : '';
  if (!active) {
    sprite.classList.remove('wardrobe-rendered');
    return;
  }
  const css = getComputedStyle(sprite);
  const base = urlValue(css.getPropertyValue('--wardrobe-base'));
  const mask = urlValue(css.getPropertyValue('--wardrobe-mask'));
  if (!base || !mask) {
    sprite.classList.remove('wardrobe-rendered');
    return;
  }
  let frame = wardrobeFrames.get(key);
  if (!frame) {
    frame = Promise.all([readPixels(base), readPixels(mask)]).then(([pixels, slots]) => recolorClothes(pixels, slots, styles.map(style => FABRICS[style])));
    wardrobeFrames.set(key, frame);
    if (wardrobeFrames.size > 45) wardrobeFrames.delete(wardrobeFrames.keys().next().value);
  }
  frame.then(image => {
    if (displayedOutfits.get(sprite) !== key) return;
    let canvas = sprite.querySelector('canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      sprite.append(canvas);
    }
    canvas.getContext('2d').putImageData(image, 0, 0);
    canvas.dataset.frame = key;
    sprite.classList.add('wardrobe-rendered');
  }).catch(() => {
    if (displayedOutfits.get(sprite) === key) sprite.classList.remove('wardrobe-rendered');
  });
}
