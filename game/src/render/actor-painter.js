// Paints everything that moves: the six car classes with their roofs, wheels, light bars and
// taxi signs; the crowd with their shirts and hair; the gunmen; the player; and the bullets,
// sparks and smoke in flight. All of it is drawn from primitives, nothing is an image.

import { fillRoundRect, roundRectPath, shade, hexToRgba, text } from './canvas-kit.js';

function paintCarBody(ctx, car, time, lighting) {
  const spec = car.spec;
  const w = spec.w;
  const h = spec.h;
  const color = car.wrecked ? shade(car.color, -60) : car.color;

  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);

  // Drop shadow.
  ctx.save();
  ctx.translate(5, 7);
  roundRectPath(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  ctx.restore();

  // Wheels.
  ctx.fillStyle = '#15171b';
  const wheelW = spec.id === 'truck' ? 16 : 12;
  const wheelH = 7;
  const axle = w * 0.31;
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.translate(axle, side * (h / 2 - 3));
    if (side < 0) ctx.rotate(car.steerAngle ?? 0);
    ctx.fillRect(-wheelW / 2, -wheelH / 2, wheelW, wheelH);
    ctx.restore();
    ctx.fillRect(-axle - wheelW / 2, side * (h / 2 - 3) - wheelH / 2, wheelW, wheelH);
  }

  // Body shell.
  roundRectPath(ctx, -w / 2, -h / 2, w, h, spec.id === 'truck' ? 5 : 9);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Bonnet and boot shading.
  const gradient = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.18)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,0.02)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.22)');
  roundRectPath(ctx, -w / 2, -h / 2, w, h, 9);
  ctx.fillStyle = gradient;
  ctx.fill();

  if (spec.id === 'truck') {
    // Cab up front, flat bed behind with rails.
    ctx.fillStyle = shade(color, -18);
    ctx.fillRect(w * 0.1, -h / 2 + 3, w * 0.36, h - 6);
    ctx.fillStyle = 'rgba(30, 26, 22, 0.85)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w * 0.52, h - 8);
    ctx.strokeStyle = 'rgba(200, 190, 170, 0.5)';
    ctx.lineWidth = 2;
    for (let x = -w / 2 + 6; x < w * 0.02; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, -h / 2 + 5);
      ctx.lineTo(x, h / 2 - 5);
      ctx.stroke();
    }
    ctx.fillStyle = '#3a3f47';
    ctx.fillRect(-w / 2 + 1, -h / 2 + 3, 5, h - 6);
  } else if (spec.id === 'van') {
    ctx.fillStyle = shade(color, -12);
    ctx.fillRect(-w * 0.34, -h / 2 + 5, w * 0.68, h - 10);
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-w * 0.34, -h / 2 + 5, w * 0.68, h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(-w * 0.3, -h / 2 + 8, w * 0.5, 4);
  } else {
    // Cabin.
    const cabinLength = spec.id === 'sports' ? w * 0.4 : w * 0.44;
    const cabinX = spec.id === 'sports' ? -w * 0.06 : -w * 0.02;
    roundRectPath(ctx, cabinX - cabinLength / 2, -h / 2 + 5, cabinLength, h - 10, 6);
    ctx.fillStyle = shade(color, -26);
    ctx.fill();
    // Windscreen and rear glass.
    ctx.fillStyle = 'rgba(150, 200, 230, 0.6)';
    ctx.fillRect(cabinX + cabinLength / 2 - 8, -h / 2 + 7, 6, h - 14);
    ctx.fillStyle = 'rgba(120, 170, 200, 0.45)';
    ctx.fillRect(cabinX - cabinLength / 2 + 2, -h / 2 + 7, 5, h - 14);
    if (spec.id === 'sports') {
      ctx.fillStyle = shade(color, 24);
      ctx.fillRect(-w / 2 + 2, -h / 2 + 4, 5, h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-w * 0.18, -h * 0.16, w * 0.36, 2.5);
    }
    if (spec.id === 'taxi') {
      ctx.fillStyle = '#1d1f24';
      ctx.fillRect(-w * 0.16, -h * 0.06, w * 0.3, 3);
      ctx.fillStyle = '#f5f0d8';
      ctx.fillRect(-w * 0.14, -h * 0.02, w * 0.28, 3);
      ctx.fillStyle = '#22262c';
      ctx.fillRect(-w * 0.12, -h * 0.34, w * 0.24, h * 0.2);
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(-w * 0.1, -h * 0.32, w * 0.2, h * 0.16);
    }
    if (spec.id === 'police') {
      ctx.fillStyle = '#1b2a4a';
      ctx.fillRect(-w * 0.46, -h / 2 + 2, w * 0.2, h - 4);
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `700 ${Math.max(7, h * 0.16)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('POLICE', 0, 0);
      // Light bar on the roof.
      const flash = Math.floor(time * 9) % 2 === 0;
      ctx.fillStyle = '#12151b';
      ctx.fillRect(-w * 0.06, -h * 0.46, w * 0.2, h * 0.92);
      ctx.fillStyle = flash ? '#ff3b52' : '#3b6bff';
      ctx.fillRect(-w * 0.045, -h * 0.42, w * 0.1, h * 0.4);
      ctx.fillStyle = flash ? '#3b6bff' : '#ff3b52';
      ctx.fillRect(-w * 0.045, h * 0.02, w * 0.1, h * 0.4);
    }
  }

  // Headlights and tail lights.
  ctx.fillStyle = lighting.lampsOn ? '#fff4c8' : '#e8e2c0';
  ctx.fillRect(w / 2 - 4, -h / 2 + 4, 3, 7);
  ctx.fillRect(w / 2 - 4, h / 2 - 11, 3, 7);
  ctx.fillStyle = car.wrecked ? '#5a2a2a' : '#e8402a';
  ctx.fillRect(-w / 2 + 1, -h / 2 + 4, 3, 7);
  ctx.fillRect(-w / 2 + 1, h / 2 - 11, 3, 7);

  if (car.driver === 'player') {
    roundRectPath(ctx, -w / 2 - 1, -h / 2 - 1, w + 2, h + 2, 10);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }
  if (car.damageFlash > 0.02) {
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 9);
    ctx.fillStyle = `rgba(255, 240, 220, ${car.damageFlash * 0.35})`;
    ctx.fill();
  }
  if (car.wrecked) {
    ctx.fillStyle = 'rgba(20, 16, 14, 0.35)';
    roundRectPath(ctx, -w / 2, -h / 2, w, h, 9);
    ctx.fill();
  }
  ctx.restore();
}

export function paintVehicle(ctx, car, time, lighting) {
  paintCarBody(ctx, car, time, lighting);
}

/** Additive light: headlight cones at night, the red/blue wash of a siren. */
export function paintVehicleGlow(ctx, car, time, lighting) {
  if (car.role === 'police' && car.sirenOn) {
    const flash = Math.floor(time * 8) % 2 === 0;
    const color = flash ? 'rgba(255, 60, 80, 0.34)' : 'rgba(70, 110, 255, 0.34)';
    const x = car.x - Math.cos(car.angle) * car.spec.w * 0.05;
    const y = car.y - Math.sin(car.angle) * car.spec.w * 0.05;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, 115);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, 115, 0, Math.PI * 2);
    ctx.fill();
  }
  if (!lighting.isNight || !car.lightsOn) return;
  const noseX = car.x + Math.cos(car.angle) * car.spec.w * 0.5;
  const noseY = car.y + Math.sin(car.angle) * car.spec.w * 0.5;
  const reach = 210;
  const spread = 0.4;
  ctx.save();
  ctx.translate(noseX, noseY);
  ctx.rotate(car.angle);
  const gradient = ctx.createLinearGradient(0, 0, reach, 0);
  gradient.addColorStop(0, 'rgba(255, 236, 180, 0.13)');
  gradient.addColorStop(0.55, 'rgba(255, 220, 150, 0.05)');
  gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(reach, -reach * Math.tan(spread));
  ctx.lineTo(reach, reach * Math.tan(spread));
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function paintPersonShadow(ctx, x, y, scale = 1) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 4, 10 * scale, 7 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

export function paintPedestrian(ctx, ped, time) {
  if (ped.state === 'dead') {
    ctx.save();
    ctx.translate(ped.x, ped.y);
    ctx.rotate(ped.angle + 1.2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(12, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  const bob = Math.sin(ped.bob) * (ped.state === 'down' ? 0 : 1.6);
  paintPersonShadow(ctx, ped.x, ped.y);
  ctx.save();
  ctx.translate(ped.x, ped.y + bob);
  if (ped.state === 'down') {
    ctx.rotate(ped.angle + 1.4);
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.skin;
    ctx.beginPath();
    ctx.arc(11, 0, 4.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = ped.hair;
    ctx.beginPath();
    ctx.arc(12.6, 0, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.rotate(ped.angle + Math.PI / 2);
  // Body.
  ctx.fillStyle = ped.shirt;
  ctx.beginPath();
  ctx.ellipse(0, 1, 7.4, 9.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // Arms swinging.
  ctx.strokeStyle = shade(ped.shirt, -16);
  ctx.lineWidth = 3.2;
  const swing = Math.sin(ped.bob) * 4;
  ctx.beginPath();
  ctx.moveTo(-5.4, -1);
  ctx.lineTo(-7.6, 5 + swing);
  ctx.moveTo(5.4, -1);
  ctx.lineTo(7.6, 5 - swing);
  ctx.stroke();
  // Head.
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(0, -6.6, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = ped.hair;
  ctx.beginPath();
  ctx.arc(0, -8, 4.8, Math.PI * 0.05, Math.PI * 0.95, true);
  ctx.fill();
  if (ped.hat) {
    ctx.fillStyle = '#e8e2d0';
    ctx.beginPath();
    ctx.arc(0, -6.6, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c9c2ae';
    ctx.beginPath();
    ctx.arc(0, -6.6, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  if (ped.bag) {
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(5, 0, 4, 6);
  }
  ctx.restore();
}

export function paintGunman(ctx, actor, time) {
  const cop = actor.faction === 'cop';
  const boss = actor.faction === 'boss';
  const body = cop ? '#33528a' : boss ? '#4a1f2a' : '#3a2f2c';
  const trim = cop ? '#9fd4ff' : boss ? '#e8402a' : '#c0563a';
  if (actor.state === 'down' || actor.health <= 0) {
    ctx.save();
    ctx.translate(actor.x, actor.y);
    ctx.rotate(actor.angle + 1.3);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 4, 13, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 0, 12.5, 6.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8a878';
    ctx.beginPath();
    ctx.arc(11, 0, 4.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  paintPersonShadow(ctx, actor.x, actor.y);
  ctx.save();
  ctx.translate(actor.x, actor.y);
  ctx.rotate(actor.angle + Math.PI / 2);
  // Legs and body.
  ctx.fillStyle = shade(body, -14);
  ctx.fillRect(-4.5, 4, 3.4, 6);
  ctx.fillRect(1.1, 4, 3.4, 6);
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 7, 8.6, 0, 0, Math.PI * 2);
  ctx.fill();
  // Vest stripe.
  ctx.fillStyle = trim;
  ctx.fillRect(-6, -2.5, 12, 3);
  // Head.
  ctx.fillStyle = '#d8a878';
  ctx.beginPath();
  ctx.arc(0, -7, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = cop ? '#1b2a4a' : '#1a1a1a';
  ctx.beginPath();
  ctx.arc(0, -8, 4.6, Math.PI, Math.PI * 2);
  ctx.fill();
  if (cop) {
    ctx.fillStyle = '#0f1a30';
    ctx.fillRect(-5.2, -9.4, 10.4, 2.6);
  }
  // Weapon held out toward the aim.
  const aimLocal = actor.aimAngle - actor.angle - Math.PI / 2;
  ctx.save();
  ctx.rotate(aimLocal);
  ctx.fillStyle = '#1a1d22';
  ctx.fillRect(0, -12, 3.4, 10);
  if (actor.muzzle > 0.3) {
    ctx.fillStyle = `rgba(255, 238, 170, ${actor.muzzle})`;
    ctx.beginPath();
    ctx.arc(1.7, -14, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  if (actor.hurtFlash > 0) {
    ctx.fillStyle = `rgba(255, 220, 200, ${actor.hurtFlash * 0.5})`;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function paintPlayer(ctx, player, time, weaponName) {
  // A soft pool of light keeps the player readable against a busy pavement.
  const halo = ctx.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
  halo.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
  halo.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(player.x, player.y, 34, 0, Math.PI * 2);
  ctx.fill();

  // A ring with a notch toward the aim direction: the player, at a glance.
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.aimAngle);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0.55, Math.PI * 2 - 0.55);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.beginPath();
  ctx.moveTo(21, 0);
  ctx.lineTo(14, -4.4);
  ctx.lineTo(14, 4.4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  paintPersonShadow(ctx, player.x, player.y, 1.1);
  const bob = Math.sin(player.bob * 2) * 1.4 * player.bobAmount;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.angle + Math.PI / 2);
  // Legs.
  ctx.fillStyle = '#20262f';
  ctx.fillRect(-5, 4.4, 3.8, 7.6);
  ctx.fillRect(1.2, 4.4, 3.8, 7.6);
  // Jacket.
  ctx.fillStyle = '#f7f6ef';
  ctx.beginPath();
  ctx.ellipse(0, 0, 8.2, 9.8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(10, 14, 20, 0.55)';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#17b3a6';
  ctx.fillRect(-7.6, -1, 15.2, 3.4);
  // Arms.
  ctx.strokeStyle = '#e0ddd2';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-6, 0);
  ctx.lineTo(-8, 5);
  ctx.moveTo(6, 0);
  ctx.lineTo(8, 5);
  ctx.stroke();
  // Head with hair.
  ctx.fillStyle = '#e8b98f';
  ctx.beginPath();
  ctx.arc(0, -7.2, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2b2118';
  ctx.beginPath();
  ctx.arc(0, -8.4, 4.8, Math.PI * 0.9, Math.PI * 2.1);
  ctx.fill();
  ctx.restore();

  // The weapon is drawn in world orientation so it points where the player aims.
  const aimLocal = player.aimAngle - player.angle - Math.PI / 2;
  ctx.save();
  ctx.translate(player.x, player.y + bob);
  ctx.rotate(player.angle + Math.PI / 2);
  ctx.rotate(aimLocal);
  if (weaponName === 'pistol') {
    ctx.fillStyle = '#15181d';
    ctx.fillRect(0, -15, 4.6, 11);
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(0.8, -9, 3, 5);
  } else if (weaponName === 'smg') {
    ctx.fillStyle = '#15181d';
    ctx.fillRect(0, -18, 5, 13);
    ctx.fillStyle = '#2b3038';
    ctx.fillRect(-2, -11, 5, 7);
    ctx.fillRect(1.2, -7, 2.6, 6);
  } else if (player.meleeTimer > 0) {
    ctx.fillStyle = '#e8b98f';
    ctx.beginPath();
    ctx.arc(1.6, -13, 3.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  if (player.hurtTimer > 0) {
    ctx.fillStyle = `rgba(255, 90, 90, ${player.hurtTimer * 0.35})`;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
    ctx.fill();
  }

  // Muzzle burst: a white-hot star with a streak down the aim line, only while firing.
  if (player.muzzleTimer > 0.002) {
    const t = Math.min(1, player.muzzleTimer / 0.09);
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.aimAngle);
    ctx.globalCompositeOperation = 'lighter';
    const streak = ctx.createLinearGradient(14, 0, 86, 0);
    streak.addColorStop(0, `rgba(255, 240, 190, ${0.7 * t})`);
    streak.addColorStop(1, 'rgba(255, 190, 110, 0)');
    ctx.fillStyle = streak;
    ctx.beginPath();
    ctx.moveTo(14, -3.4 * t);
    ctx.lineTo(86, -1.6 * t);
    ctx.lineTo(86, 1.6 * t);
    ctx.lineTo(14, 3.4 * t);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `rgba(255, 248, 214, ${0.95 * t})`;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i * Math.PI) / 4;
      const radius = i % 2 === 0 ? 13 + 8 * t : 4.4;
      const px = 24 + Math.cos(angle) * radius;
      const py = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}

export function paintBullet(ctx, bullet) {
  const length = 20;
  const angle = Math.atan2(bullet.vy, bullet.vx);
  ctx.strokeStyle = 'rgba(255, 240, 180, 0.95)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(bullet.x, bullet.y);
  ctx.lineTo(bullet.x - Math.cos(angle) * length, bullet.y - Math.sin(angle) * length);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 220, 0.9)';
  ctx.beginPath();
  ctx.arc(bullet.x, bullet.y, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

export function paintParticles(ctx, effects) {
  for (let i = 0; i < effects.particles.length; i += 1) {
    const p = effects.particles[i];
    const life = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(120, 126, 138, ${0.3 * life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'dust') {
      ctx.fillStyle = `rgba(184, 168, 136, ${0.4 * life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255, 236, 170, ${0.85 * life})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = life;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
}

export function paintVehicleLabel(ctx, car) {
  if (!car.stolen) return;
  text(ctx, car.label, car.x, car.y - 34, { size: 10, weight: 700, color: 'rgba(255,255,255,0.5)', align: 'center' });
}

export { fillRoundRect, hexToRgba };
