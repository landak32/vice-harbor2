// Character portraits, drawn from a handful of numbers: a face in a rounded frame with hair, eyes,
// brows, a nose, a mouth and a collar in the character's colours. No image file is involved, and
// the same character always gets the same face.

import { fillRoundRect, roundRectPath, text, hexToRgba, shade } from './canvas-kit.js';

export function paintPortrait(ctx, x, y, size, contact, options = {}) {
  const skin = contact.skin ?? '#d8a878';
  const hair = contact.hair ?? '#2b1a12';
  const shirt = contact.shirt ?? '#3f4a5a';
  const accent = contact.accent ?? '#ffd166';
  const mood = options.mood ?? 'talk';

  ctx.save();
  roundRectPath(ctx, x, y, size, size, size * 0.12);
  ctx.clip();

  // Backdrop: a soft two-tone wash in the character's accent colour.
  const gradient = ctx.createLinearGradient(x, y, x, y + size);
  gradient.addColorStop(0, hexToRgba(accent, 0.55));
  gradient.addColorStop(1, '#0b0e16');
  ctx.fillStyle = gradient;
  ctx.fillRect(x, y, size, size);

  const cx = x + size / 2;
  const headR = size * 0.26;
  const headY = y + size * 0.46;

  // Shoulders and collar.
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(cx, y + size * 0.98, size * 0.42, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(shirt, 18);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.14, y + size * 0.78);
  ctx.lineTo(cx, y + size * 0.9);
  ctx.lineTo(cx + size * 0.14, y + size * 0.78);
  ctx.closePath();
  ctx.fill();

  // Neck.
  ctx.fillStyle = shade(skin, -14);
  ctx.fillRect(cx - size * 0.09, headY + headR * 0.55, size * 0.18, size * 0.16);

  // Head.
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(cx, headY, headR * 0.82, headR, 0, 0, Math.PI * 2);
  ctx.fill();
  // Jaw shadow.
  ctx.fillStyle = hexToRgba('#000000', 0.1);
  ctx.beginPath();
  ctx.ellipse(cx, headY + headR * 0.42, headR * 0.62, headR * 0.4, 0, 0, Math.PI);
  ctx.fill();

  // Hair: a cap over the top of the skull, with a side sweep.
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(cx, headY - headR * 0.42, headR * 0.86, headR * 0.62, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx - headR * 0.55, headY - headR * 0.1, headR * 0.3, headR * 0.5, 0.3, 0, Math.PI * 2);
  ctx.fill();

  // Brows.
  ctx.strokeStyle = shade(hair, 12);
  ctx.lineWidth = Math.max(2, size * 0.018);
  ctx.lineCap = 'round';
  const browY = headY - headR * 0.16;
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.5, browY);
  ctx.lineTo(cx - headR * 0.18, browY - headR * 0.06);
  ctx.moveTo(cx + headR * 0.18, browY - headR * 0.06);
  ctx.lineTo(cx + headR * 0.5, browY);
  ctx.stroke();

  // Eyes with a catchlight; narrowed when the character is angry.
  const eyeY = headY - headR * 0.02;
  const eyeOffset = headR * 0.32;
  const eyeH = mood === 'angry' ? headR * 0.1 : headR * 0.16;
  for (const side of [-1, 1]) {
    ctx.fillStyle = '#f7f3ec';
    ctx.beginPath();
    ctx.ellipse(cx + side * eyeOffset, eyeY, headR * 0.16, eyeH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.beginPath();
    ctx.arc(cx + side * eyeOffset + headR * 0.03, eyeY, headR * 0.075, 0, Math.PI * 2);
    ctx.fill();
  }

  // Nose and mouth.
  ctx.strokeStyle = hexToRgba('#000000', 0.28);
  ctx.lineWidth = Math.max(1.5, size * 0.012);
  ctx.beginPath();
  ctx.moveTo(cx - headR * 0.04, eyeY + headR * 0.18);
  ctx.lineTo(cx + headR * 0.02, eyeY + headR * 0.34);
  ctx.lineTo(cx - headR * 0.08, eyeY + headR * 0.36);
  ctx.stroke();

  ctx.strokeStyle = mood === 'angry' ? '#7a2b2b' : '#8a4a44';
  ctx.lineWidth = Math.max(2, size * 0.02);
  ctx.beginPath();
  if (mood === 'angry') {
    ctx.moveTo(cx - headR * 0.24, headY + headR * 0.55);
    ctx.quadraticCurveTo(cx, headY + headR * 0.44, cx + headR * 0.24, headY + headR * 0.55);
  } else {
    ctx.moveTo(cx - headR * 0.22, headY + headR * 0.5);
    ctx.quadraticCurveTo(cx, headY + headR * 0.6, cx + headR * 0.22, headY + headR * 0.5);
  }
  ctx.stroke();

  // A pair of sunglasses for the fixer.
  if (options.glasses) {
    ctx.fillStyle = 'rgba(14, 18, 26, 0.9)';
    ctx.beginPath();
    ctx.ellipse(cx - eyeOffset, eyeY, headR * 0.22, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + eyeOffset, eyeY, headR * 0.22, headR * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(14, 18, 26, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - eyeOffset + headR * 0.2, eyeY);
    ctx.lineTo(cx + eyeOffset - headR * 0.2, eyeY);
    ctx.stroke();
  }

  // Frame and name plate.
  ctx.restore();
  roundRectPath(ctx, x, y, size, size, size * 0.12);
  ctx.strokeStyle = hexToRgba(accent, 0.9);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(6, 8, 14, 0.72)';
  ctx.fillRect(x, y + size - size * 0.2, size, size * 0.2);
  text(ctx, contact.name ?? 'Unknown', x + size / 2, y + size - size * 0.06, {
    size: size * 0.095,
    weight: 700,
    color: '#f4f6fa',
    align: 'center',
    baseline: 'alphabetic',
  });
}

/** A tiny portrait used on the mission-start marker and in the journal list. */
export function paintPortraitBadge(ctx, x, y, size, contact) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, size / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = contact.skin ?? '#d8a878';
  ctx.fillRect(x - size, y - size, size * 2, size * 2);
  ctx.fillStyle = contact.hair ?? '#2b1a12';
  ctx.beginPath();
  ctx.arc(x, y - size * 0.12, size * 0.46, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#20242c';
  ctx.fillRect(x - size * 0.22, y, size * 0.1, size * 0.08);
  ctx.fillRect(x + size * 0.12, y, size * 0.1, size * 0.08);
  ctx.restore();
}

export { fillRoundRect };
