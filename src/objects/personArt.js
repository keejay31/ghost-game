import { makeArt } from '../fx/pixelArt.js';
import { mixColor } from '../fx/Lighting.js';

// Человек рисуется кодом. У него «скелет»: бёдра, колени, плечи, локти. Поза — это где
// стоят ступни и где ладони, а колени и локти сгибаются сами.
// Все кадры лежат в одной картинке в ряд, человек смотрит вправо.

const FRAME_W = 56;
const FRAME_H = 112;
export const PERSON_HEIGHT = 96; // рост: дверь в комнате — 128, пианино — 72

const OUTLINE = 0x15101c;
const SHOE = 0x33262a;
const SOLE = 0x1c1418;
const BELT = 0x241a1c;
const BUCKLE = 0xd9ae38;
const MOUTH = 0x8a4a48;
const MOUTH_OPEN = 0x3a1418;

// Размеры тела в пикселях
const LEG = 17.8; // бедро и голень
const ARM = 15; // плечо и предплечье
const HIP_UP = 40; // бёдра над полом
const TORSO = 33; // от бёдер до плеч

// Шаг. Если менять — подстроить WALK_FPS и RUN_FPS в Person.js, иначе ноги «скользят»
export const STEP_FRAMES = 8; // кадров в цикле шага
export const WALK_STEP = 8; // на сколько ступня уходит вперёд и назад
export const RUN_STEP = 14;

// Где ступня в цикле шага: полцикла стоит на полу и едет назад, полцикла летит вперёд
function footAt(phase, step, lift) {
  const p = phase % 1;
  if (p < 0.5) return { x: step - 4 * step * p, up: 0 };
  return { x: -step + 4 * step * (p - 0.5), up: Math.sin((p - 0.5) * 2 * Math.PI) * lift };
}

// Позы. near и far — ближняя и дальняя ступня, nearHand и farHand — ладони (от плеча:
// x — вперёд, y — вниз). drop — тело присело, lean — наклон вперёд
const POSES = {
  idle: { near: { x: 1, up: 0 }, far: { x: -2, up: 0 }, nearHand: { x: -1, y: 29 }, farHand: { x: 1, y: 29 } },
  scared: {
    near: { x: 8, up: 0 },
    far: { x: -9, up: 0 },
    drop: 2,
    nearHand: { x: -9, y: -27 },
    farHand: { x: 15, y: -24 },
    scared: true,
  },
};
for (let i = 0; i < STEP_FRAMES; i++) {
  const p = i / STEP_FRAMES;
  const wide = Math.abs(Math.cos(p * 2 * Math.PI)); // 1 — ноги широко, 0 — вместе

  // Ходьба: руки машут навстречу ногам
  const swing = Math.cos(p * 2 * Math.PI) * 6;
  POSES[`walk${i}`] = {
    near: footAt(p, WALK_STEP, 5),
    far: footAt(p + 0.5, WALK_STEP, 5),
    drop: wide * 1.5,
    nearHand: { x: -swing, y: 29 - Math.abs(swing) * 0.3 },
    farHand: { x: swing, y: 29 - Math.abs(swing) * 0.3 },
  };

  // Бег в панике: руки вверх и машут. Ближняя рука — за головой, чтобы не закрывать лицо
  const wave = Math.sin(p * 4 * Math.PI) * 4;
  POSES[`run${i}`] = {
    near: footAt(p, RUN_STEP, 11),
    far: footAt(p + 0.5, RUN_STEP, 11),
    drop: wide * 3,
    lean: 3,
    nearHand: { x: -6 - wave, y: -27 - wave * 0.5 },
    farHand: { x: 13 + wave, y: -25 + wave * 0.5 },
    scared: true,
  };
}

// Круг
function disc(b, cx, cy, r, color) {
  for (let dy = -Math.floor(r); dy <= Math.floor(r); dy++) {
    const w = Math.floor(Math.sqrt(r * r - dy * dy));
    b.rect(Math.round(cx) - w, Math.round(cy) + dy, w * 2 + 1, 1, color);
  }
}

// Толстая линия со скруглёнными концами (рука, нога): толщина меняется от r0 до r1
function capsule(b, from, to, r0, r1, color) {
  const steps = Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    disc(b, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, r0 + (r1 - r0) * t, color);
  }
}

// Где сустав (колено, локоть) между двумя «костями» длиной size, если конечность
// тянется от from к to. side: 1 или -1 — в какую сторону сгиб
function bend(from, to, size, side) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const half = Math.min(dist, size * 2 - 0.01) / 2;
  const out = Math.sqrt(size * size - half * half); // на сколько сустав выпирает вбок
  return {
    x: from.x + (dx / dist) * half + (dy / dist) * out * side,
    y: from.y + (dy / dist) * half - (dx / dist) * out * side,
  };
}

// Нога: бедро, голень и ботинок носком вперёд
function paintLeg(b, hip, foot, ground, color) {
  const ankle = { x: hip.x + foot.x, y: ground - 5 - foot.up };
  const knee = bend(hip, ankle, LEG, 1);
  capsule(b, hip, knee, 4.5, 4, color);
  capsule(b, knee, ankle, 4, 3, color);

  const x = Math.round(ankle.x);
  const y = Math.round(ankle.y);
  b.rect(x - 4, y + 1, 10, 2, SHOE);
  b.rect(x - 4, y + 3, 13, 2, SHOE);
  b.rect(x - 4, y + 5, 13, 1, SOLE);
}

// Рука: плечо, предплечье и ладонь. grow — на сколько толще (для тёмной каёмки)
function paintArm(b, shoulder, hand, sleeve, skin, grow = 0) {
  const palm = { x: shoulder.x + hand.x, y: shoulder.y + hand.y };
  // Опущенная рука сгибается локтем назад, поднятая — в сторону
  const elbow = bend(shoulder, palm, ARM, hand.y > 0 ? -1 : -Math.sign(hand.x));
  capsule(b, shoulder, elbow, 3.5 + grow, 3 + grow, sleeve);
  capsule(b, elbow, palm, 3 + grow, 2.5 + grow, sleeve);
  disc(b, palm.x, palm.y, 3 + grow, skin);
}

// Туловище: плечи шире, талия уже, внизу пояс и верх брюк
function paintTorso(b, hip, neck, c) {
  const bottom = hip.y + 3;
  for (let y = neck.y; y <= bottom; y++) {
    const t = (y - neck.y) / (bottom - neck.y); // 0 — плечи, 1 — низ
    const x = neck.x + (hip.x - neck.x) * t;
    let half = 9.5 - 1.5 * Math.sin(t * Math.PI);
    if (y - neck.y < 3) half -= (3 - (y - neck.y)) * 1.5; // скруглённые плечи
    const left = Math.round(x - half);
    const right = Math.round(x + half);

    const belt = y >= hip.y - 4 && y <= hip.y - 2;
    const pants = y > hip.y - 2;
    b.rect(left, y, right - left + 1, 1, belt ? BELT : pants ? c.pants : c.shirt);
    if (!belt) b.rect(left, y, 3, 1, pants ? c.pantsDark : c.shirtDark); // спина в тени
    if (!belt && !pants && (y - neck.y) % 6 === 5) b.dot(Math.round(x) + 4, y, c.shirtDark); // пуговицы
  }
  b.rect(hip.x + 3, hip.y - 4, 3, 3, BUCKLE);

  // Шея и воротник
  b.rect(neck.x - 1, neck.y - 3, 5, 4, c.skinDark);
  b.rect(neck.x - 5, neck.y, 5, 2, c.shirtLight);
  b.rect(neck.x + 3, neck.y, 5, 2, c.shirtLight);
  b.rect(neck.x, neck.y, 3, 2, c.skinDark);
  b.dot(neck.x + 1, neck.y + 2, c.skinDark);
}

// Голова в три четверти: лицо справа, волосы сверху и сзади
function paintHead(b, cx, cy, c, scared) {
  const RX = 9;
  const RY = 10;
  for (let dy = -RY - 1; dy <= RY; dy++) {
    for (let dx = -RX - 1; dx <= RX; dx++) {
      const inHead = (dx / RX) ** 2 + (dy / RY) ** 2 <= 1;
      // Волосы пышнее головы и спускаются к затылку
      const inCap = ((dx + 1) / (RX + 1)) ** 2 + ((dy + 1) / (RY + 1)) ** 2 <= 1;
      const hairline = -3 - dx * 0.55;
      if (inCap && dy < hairline) b.dot(cx + dx, cy + dy, dy < hairline - 6 ? c.hairLight : c.hair);
      else if (inHead) b.dot(cx + dx, cy + dy, dx < -5 || dy > 7 || dy < hairline + 1 ? c.skinDark : c.skin);
    }
  }
  // Длинные волосы закрывают затылок и шею
  if (c.longHair) {
    for (let dy = 0; dy <= 13; dy++) b.rect(cx - 10 + (dy > 10 ? 1 : 0), cy + dy, 6 - (dy > 11 ? 1 : 0), 1, c.hair);
  } else {
    b.rect(cx - 5, cy, 3, 4, c.skinDark); // ухо
    b.dot(cx - 4, cy + 1, c.skin);
  }

  // Нос
  b.rect(cx + 4, cy + 1, 1, 3, c.skinDark);
  b.dot(cx + 5, cy + 3, c.skinDark);

  if (scared) {
    // Круглые глаза, брови домиком, рот открыт
    for (const ex of [0, 5]) {
      b.rect(cx + ex, cy - 3, 4, 5, 0xffffff);
      b.rect(cx + ex + 2, cy - 1, 2, 2, OUTLINE);
    }
    b.line(cx - 1, cy - 5, cx + 3, cy - 7, c.hair);
    b.line(cx + 5, cy - 7, cx + 8, cy - 6, c.hair);
    b.rect(cx + 2, cy + 5, 4, 3, MOUTH_OPEN);
    b.rect(cx + 3, cy + 4, 2, 5, MOUTH_OPEN);
    b.rect(cx + 3, cy + 4, 2, 1, 0xffffff);
  } else {
    for (const ex of [1, 6]) {
      b.rect(cx + ex, cy - 1, 2, 3, OUTLINE);
      b.dot(cx + ex, cy - 1, 0xffffff);
    }
    b.rect(cx, cy - 4, 4, 1, c.hair);
    b.rect(cx + 5, cy - 4, 3, 1, c.hair);
    b.rect(cx + 2, cy + 6, 4, 1, MOUTH);
  }
}

// Одна поза. cx — середина человека, ground — где стоят ступни
function paintPose(b, cx, ground, pose, c) {
  const { near, far, nearHand, farHand, drop = 0, lean = 0, scared = false } = pose;
  const hip = { x: cx, y: ground - HIP_UP + Math.round(drop) };
  const neck = { x: cx + lean, y: hip.y - TORSO };
  const nearShoulder = { x: neck.x - 1, y: neck.y + 4 };
  const farShoulder = { x: neck.x + 3, y: neck.y + 4 };

  // Дальние рука и нога — темнее, они в тени
  paintArm(b, farShoulder, farHand, c.shirtDark, c.skinDark);
  paintLeg(b, { x: hip.x - 2, y: hip.y }, far, ground, c.pantsDark);
  paintLeg(b, { x: hip.x + 1, y: hip.y }, near, ground, c.pants);

  paintTorso(b, hip, neck, c);
  paintHead(b, neck.x + 1, neck.y - 11, c, scared);

  // Ближняя рука с тёмной каёмкой — чтобы не сливалась с туловищем
  paintArm(b, nearShoulder, nearHand, c.shirtDark, c.skinDark, 1);
  paintArm(b, nearShoulder, nearHand, c.shirtLight, c.skin);
}

// Картинка человека со всеми позами. colors: shirt, skin, hair, pants, longHair
export function makePersonTexture(scene, key, colors) {
  const c = {
    ...colors,
    skinDark: mixColor(colors.skin, 0x000000, 0.22),
    shirtDark: mixColor(colors.shirt, 0x000000, 0.3),
    shirtLight: mixColor(colors.shirt, 0xffffff, 0.18),
    pantsDark: mixColor(colors.pants, 0x000000, 0.3),
    hairLight: mixColor(colors.hair, 0xffffff, 0.2),
  };
  const names = Object.keys(POSES);
  const tex = makeArt(scene, key, FRAME_W * names.length, FRAME_H, (b) => {
    names.forEach((name, i) => paintPose(b, i * FRAME_W + FRAME_W / 2, FRAME_H - 2, POSES[name], c));
    b.outline(OUTLINE);
  });
  // Каждая поза — отдельный кадр с именем
  names.forEach((name, i) => tex.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
}
