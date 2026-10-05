import { makeArt } from '../fx/pixelArt.js';
import { mixColor } from '../fx/Lighting.js';

// Человечек рисуется кодом: голова — «рисунком из букв», тело, руки и ноги — по позе.
// Все позы лежат в одной картинке в ряд, человечек смотрит вправо.

const FRAME_W = 22;
const FRAME_H = 42;
const OUTLINE = 0x15101c;
const SHOE = 0x241a1c;

// h — волосы, s — кожа, S — кожа в тени, e — глаз, w — белок глаза, m — рот
const HEAD = [
  '..hhhhhh..',
  '.hhhhhhhh.',
  'hhhhhhhhh.',
  'hhhsssssss',
  'hhssessess',
  'hhssessess',
  '.Sssssssss',
  '.Ssssssss.',
  '..Ssssss..',
  '...SSss...',
];
const HEAD_SCARED = [
  '..hhhhhh..',
  '.hhhhhhhh.',
  'hhhhhhhhh.',
  'hhhsssssss',
  'hhswwswwss',
  'hhsweswess',
  '.Sssssssss',
  '.Sssmmmss.',
  '..SsmmmS..',
  '...SSss...',
];

// Позы. near и far — ближняя и дальняя нога: [сдвиг ступни вперёд, подъём ступни].
// up — тело приподнято, swing — мах рукой, panic — руки вверх (1 и -1 — машет по очереди)
const POSES = {
  idle: { near: [0, 0], far: [0, 0] },
  walk0: { near: [3, 0], far: [-3, 0], swing: -2 },
  walk1: { near: [0, 0], far: [1, 2], up: 1 },
  walk2: { near: [-3, 0], far: [3, 0], swing: 2 },
  walk3: { near: [1, 2], far: [0, 0], up: 1 },
  scared: { near: [4, 0], far: [-4, 0], panic: 1 },
  run0: { near: [6, 0], far: [-5, 2], panic: 1 },
  run1: { near: [1, 0], far: [2, 4], up: 1, panic: -1 },
  run2: { near: [-5, 2], far: [6, 0], panic: 1 },
  run3: { near: [2, 4], far: [1, 0], up: 1, panic: -1 },
};

// Рука: полоска от плеча до кисти, на конце — ладонь
function arm(b, x0, y0, x1, y1, color, hand) {
  const steps = Math.abs(y1 - y0);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    b.rect(x, y0 + Math.sign(y1 - y0) * i, 2, 1, i >= steps - 1 ? hand : color);
  }
}

// Нога: от бедра до ступни, внизу ботинок носком вперёд
function leg(b, hipX, hipY, footX, footY, color) {
  const steps = footY - 2 - hipY;
  for (let i = 0; i <= steps; i++) {
    b.rect(Math.round(hipX + ((footX - hipX) * i) / steps) - 1, hipY + i, 3, 1, color);
  }
  b.rect(footX - 1, footY - 1, 4, 2, SHOE);
}

// Одна поза. cx — середина человечка, ground — где стоят ступни
function paintPose(b, cx, ground, pose, c) {
  const { near, far, up = 0, swing = 0, panic = 0 } = pose;
  const hipY = ground - 13 - up;
  const top = hipY - 10; // плечи

  // Дальние рука и нога — темнее, они в тени
  if (panic) arm(b, cx - 4, top + 2, cx - 7, top - 12 + panic, c.shirtDark, c.skinDark);
  else arm(b, cx - 2, top + 1, cx - 2 - swing, top + 9, c.shirtDark, c.skinDark);
  leg(b, cx - 1, hipY, cx - 1 + far[0], ground - far[1], c.pantsDark);
  leg(b, cx + 1, hipY, cx + 1 + near[0], ground - near[1], c.pants);

  // Туловище: спина в тени, внизу пояс
  b.rect(cx - 3, top, 7, 1, c.shirt);
  b.rect(cx - 4, top + 1, 9, 10, c.shirt);
  b.rect(cx - 4, top + 1, 2, 10, c.shirtDark);
  b.rect(cx - 4, top + 9, 9, 2, c.pants);

  b.stamp(cx - 5, top - 10, panic ? HEAD_SCARED : HEAD, {
    h: c.hair,
    s: c.skin,
    S: c.skinDark,
    e: OUTLINE,
    w: 0xffffff,
    m: 0x3a1418,
  });

  // Ближняя рука
  if (panic) arm(b, cx + 3, top + 2, cx + 6, top - 12 - panic, c.shirtLight, c.skin);
  else arm(b, cx, top + 1, cx + swing, top + 9, c.shirtLight, c.skin);
}

// Картинка человека со всеми позами. colors: shirt, skin, hair, pants
export function makePersonTexture(scene, key, colors) {
  const c = {
    ...colors,
    skinDark: mixColor(colors.skin, 0x000000, 0.25),
    shirtDark: mixColor(colors.shirt, 0x000000, 0.3),
    shirtLight: mixColor(colors.shirt, 0xffffff, 0.18),
    pantsDark: mixColor(colors.pants, 0x000000, 0.3),
  };
  const names = Object.keys(POSES);
  const tex = makeArt(scene, key, FRAME_W * names.length, FRAME_H, (b) => {
    names.forEach((name, i) => paintPose(b, i * FRAME_W + FRAME_W / 2, FRAME_H - 2, POSES[name], c));
    b.outline(OUTLINE);
  });
  // Каждая поза — отдельный кадр с именем
  names.forEach((name, i) => tex.add(name, 0, i * FRAME_W, 0, FRAME_W, FRAME_H));
}
