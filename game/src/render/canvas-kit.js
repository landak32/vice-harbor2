// Shared canvas drawing helpers: rounded rectangles, stars, diamonds, glow discs, text with a
// shadow, and the letter-spaced display type used by the menus and the HUD. Every painter builds
// on these so the whole game shares one visual language.

export const FONT_STACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const MONO_STACK = '"SF Mono", "Consolas", "DejaVu Sans Mono", monospace';

export function roundRectPath(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function fillRoundRect(ctx, x, y, w, h, radius, fill) {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function strokeRoundRect(ctx, x, y, w, h, radius, stroke, width = 2) {
  roundRectPath(ctx, x, y, w, h, radius);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = width;
  ctx.stroke();
}

export function starPath(ctx, cx, cy, outer, inner, points = 5, rotation = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = rotation + (i * Math.PI) / points;
    const px = cx + Math.cos(angle) * radius;
    const py = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawStar(ctx, cx, cy, outer, inner, fill, rotation = -Math.PI / 2) {
  starPath(ctx, cx, cy, outer, inner, 5, rotation);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function diamondPath(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size, cy);
  ctx.closePath();
}

export function glowDisc(ctx, x, y, radius, color, alpha = 1) {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function text(ctx, value, x, y, { size = 16, weight = 400, color = '#ffffff', align = 'left', baseline = 'alphabetic', font = FONT_STACK, shadow = null, letterSpacing = 0 } = {}) {
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (letterSpacing !== 0 && 'letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  if (shadow) {
    ctx.save();
    ctx.shadowColor = shadow.color ?? 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = shadow.blur ?? 6;
    ctx.shadowOffsetY = shadow.offsetY ?? 2;
    ctx.fillText(value, x, y);
    ctx.restore();
  } else {
    ctx.fillText(value, x, y);
  }
  if (letterSpacing !== 0 && 'letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

export function measureText(ctx, value, size, weight = 400, font = FONT_STACK) {
  ctx.font = `${weight} ${size}px ${font}`;
  return ctx.measureText(value).width;
}

/** Truncates a string with an ellipsis until it fits a width. */
export function fitText(ctx, value, maxWidth, size, weight = 400) {
  ctx.font = `${weight} ${size}px ${FONT_STACK}`;
  if (ctx.measureText(value).width <= maxWidth) return value;
  let cut = value;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

export function hexToRgba(hex, alpha) {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function shade(hex, amount) {
  const clean = hex.replace('#', '');
  const value = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = Math.round(Math.min(255, Math.max(0, parseInt(value.slice(0, 2), 16) + amount)));
  const g = Math.round(Math.min(255, Math.max(0, parseInt(value.slice(2, 4), 16) + amount)));
  const b = Math.round(Math.min(255, Math.max(0, parseInt(value.slice(4, 6), 16) + amount)));
  return `rgb(${r}, ${g}, ${b})`;
}
