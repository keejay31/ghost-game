import Phaser from 'phaser';
import { makeLightTexture, mixColor } from '../fx/Lighting.js';
import { makeArt } from '../fx/pixelArt.js';

// Цвета окна
const FRAME = 0x6e5a80;
const FRAME_LIGHT = 0x8c76a2;
const FRAME_DARK = 0x433456;
const SKY_TOP = 0x0c1638;
const SKY_BOTTOM = 0x2c4c82;
const STAR = 0xcfe0ff;
const MOON = 0xf4f7ff;
const MOON_SHADE = 0xd3def6;
const MOON_CRATER = 0xb9c8ea;
const CLOUD = 0x223764;
const CLOUD_RIM = 0x6f8cc4; // край облака, подсвеченный луной
const TREE = 0x070d1e;
const BARS = 0x1d1828; // переплёт — тёмный силуэт на фоне неба
const BARS_LIGHT = 0x2e2840;
const MOONLIGHT = 0x9fc4ff; // холодный лунный свет

const SIZE = 96; // стекло
const PAD = 8; // место вокруг стекла под раму и подоконник
const MOON_AT = { x: 73, y: 25, r: 8 }; // луна на стекле
const BAND = 12; // высота полосы неба одного цвета

// Облака: [x, y, длина] каждой полоски, сверху вниз
const CLOUDS = [
  [[60, 31, 22], [52, 32, 40], [48, 33, 48], [54, 34, 38], [62, 35, 20]],
  [[10, 60, 18], [4, 61, 34], [2, 62, 42], [8, 63, 30]],
  [[58, 74, 20], [52, 75, 36], [56, 76, 26]],
];

// Голое дерево за окном: ветки [x0, y0, x1, y1]
const BRANCHES = [
  [10, 96, 16, 76],
  [11, 96, 17, 76],
  [16, 76, 22, 58],
  [17, 76, 23, 58],
  [22, 58, 14, 40],
  [22, 58, 34, 44],
  [18, 74, 4, 62],
  [34, 44, 40, 30],
  [34, 44, 44, 47],
  [14, 40, 9, 27],
  [14, 40, 23, 30],
  [8, 65, 2, 54],
];

// Нарисовать окно: рама, небо, звёзды, луна, облака, дерево
function paintWindow(scene) {
  const rnd = new Phaser.Math.RandomDataGenerator(['window']);
  makeArt(scene, 'window', SIZE + PAD * 2, SIZE + PAD * 2 + 4, (b) => {
    // Рама и подоконник
    b.rect(PAD - 5, PAD - 5, SIZE + 10, SIZE + 10, FRAME);
    b.rect(PAD - 5, PAD - 5, SIZE + 10, 1, FRAME_LIGHT);
    b.rect(PAD - 5, PAD - 5, 1, SIZE + 10, FRAME_LIGHT);
    b.rect(PAD + SIZE + 4, PAD - 5, 1, SIZE + 10, FRAME_DARK);
    b.rect(PAD - 1, PAD - 1, SIZE + 2, SIZE + 2, FRAME_DARK);
    b.rect(0, PAD + SIZE + 5, SIZE + PAD * 2, 4, FRAME);
    b.rect(0, PAD + SIZE + 5, SIZE + PAD * 2, 1, FRAME_LIGHT);
    b.rect(0, PAD + SIZE + 8, SIZE + PAD * 2, 1, FRAME_DARK);
    b.rect(2, PAD + SIZE + 9, SIZE + PAD * 2 - 4, 2, 0x000000, 0.3);

    // Небо: полосы от тёмного к светлому, на границах — «шахматка»
    const bands = SIZE / BAND;
    const bandColor = (i) => mixColor(SKY_TOP, SKY_BOTTOM, Math.min(i, bands - 1) / (bands - 1));
    for (let y = 0; y < SIZE; y++) {
      const band = Math.floor(y / BAND);
      b.rect(PAD, PAD + y, SIZE, 1, bandColor(band));
      if (y % BAND < BAND - 2) continue;
      for (let x = (y % 2) * 1; x < SIZE; x += 2) b.dot(PAD + x, PAD + y, bandColor(band + 1));
    }

    // Звёзды
    for (let i = 0; i < 22; i++) {
      b.dot(PAD + rnd.between(1, SIZE - 2), PAD + rnd.between(1, 60), STAR, rnd.pick([0.4, 0.7, 1]));
    }
    for (const [sx, sy] of [[18, 14], [38, 22], [88, 52]]) {
      b.rect(PAD + sx - 1, PAD + sy, 3, 1, STAR, 0.6);
      b.rect(PAD + sx, PAD + sy - 1, 1, 3, STAR, 0.6);
      b.dot(PAD + sx, PAD + sy, 0xffffff);
    }

    // Луна с кратерами
    const m = MOON_AT;
    for (let y = -m.r; y <= m.r; y++) {
      for (let x = -m.r; x <= m.r; x++) {
        const d = Math.hypot(x, y);
        if (d > m.r) continue;
        const shaded = Math.hypot(x - 3, y + 3) > m.r; // тень по краю снизу-слева
        b.dot(PAD + m.x + x, PAD + m.y + y, shaded ? MOON_SHADE : MOON);
      }
    }
    for (const [cx, cy, w, h] of [[-4, -3, 3, 2], [1, 1, 2, 2], [-3, 3, 2, 1], [3, -4, 1, 1], [4, 3, 1, 2]]) {
      b.rect(PAD + m.x + cx, PAD + m.y + cy, w, h, MOON_CRATER);
    }

    // Облака: верхний край светится от луны
    for (const cloud of CLOUDS) {
      cloud.forEach(([cx, cy, len], i) => b.rect(PAD + cx, PAD + cy, len, 1, i === 0 ? CLOUD_RIM : CLOUD, 0.9));
      const [cx, cy, len] = cloud[1];
      b.rect(PAD + cx, PAD + cy, 6, 1, CLOUD_RIM, 0.9);
      b.rect(PAD + cx + len - 8, PAD + cy, 8, 1, CLOUD_RIM, 0.9);
    }

    // Дерево и кусты внизу
    for (const [x0, y0, x1, y1] of BRANCHES) b.line(PAD + x0, PAD + y0, PAD + x1, PAD + y1, TREE);
    for (let x = 0; x < SIZE; x++) {
      const h = 3 + Math.round(2 * Math.sin(x * 0.21) + 2 * Math.sin(x * 0.07 + 2)) + rnd.between(0, 2);
      b.rect(PAD + x, PAD + SIZE - h, 1, h, TREE);
    }

    // Блики на стекле
    for (const [gx, gy] of [[6, 30], [56, 36]]) {
      b.line(PAD + gx, PAD + gy, PAD + gx + 22, PAD + gy - 22, 0xffffff, 0.07);
      b.line(PAD + gx + 5, PAD + gy, PAD + gx + 27, PAD + gy - 22, 0xffffff, 0.05);
    }

    // Переплёт
    b.rect(PAD + SIZE / 2 - 2, PAD, 4, SIZE, BARS);
    b.rect(PAD, PAD + SIZE / 2 - 2, SIZE, 4, BARS);
    b.rect(PAD + SIZE / 2 - 2, PAD, 1, SIZE, BARS_LIGHT);
    b.rect(PAD, PAD + SIZE / 2 - 2, SIZE, 1, BARS_LIGHT);
  });
}

// Пятно лунного света на полу — окно, «упавшее» на пол наискосок.
// Низ окна падает ближе к стене, верх — дальше, и всё уезжает влево
const NEAR = { y: 10, slide: 60 };
const FAR = { y: 50, slide: 110 };

const smooth = Phaser.Math.SmoothStep;

// Окно с луной. x, y — левый верхний угол стекла
export class MoonWindow {
  constructor(scene, x, y, floorY) {
    paintWindow(scene);
    scene.add.image(x - PAD, y - PAD, 'window').setOrigin(0);

    const lighting = scene.lighting;

    // Небо за окном не темнеет, когда в комнате гаснет свет
    lighting.addLight('__WHITE', 0xffffff).setOrigin(0).setPosition(x, y).setDisplaySize(SIZE, SIZE);
    // Луна сияет, стена вокруг окна чуть подсвечена
    lighting.addGlow('light-soft', MOON).setPosition(x + MOON_AT.x, y + MOON_AT.y).setDisplaySize(64, 64).setAlpha(0.45);
    lighting
      .addLight('light-soft', MOONLIGHT)
      .setPosition(x + SIZE / 2, y + SIZE / 2)
      .setDisplaySize(280, 280)
      .setAlpha(0.3);

    const nearY = floorY + NEAR.y;
    const farY = floorY + FAR.y;

    // Пятно на полу
    const patch = { x: x - FAR.slide - 4, y: nearY - 4, w: SIZE + FAR.slide - NEAR.slide + 8, h: farY - nearY + 8 };
    makeLightTexture(scene, 'moon-patch', patch.w, patch.h, (px, py) => {
      const v = (py + patch.y - nearY) / (farY - nearY); // 0 — низ окна, 1 — верх
      const left = x - NEAR.slide - (FAR.slide - NEAR.slide) * v;
      const u = (px + patch.x - left) / SIZE; // 0 — левый край окна, 1 — правый
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const du = Math.min(u, 1 - u) * SIZE; // пикселей до края пятна
      const dv = Math.min(v, 1 - v) * (farY - nearY);
      // Тень от переплёта — крест посередине
      const bars = smooth(Math.abs(u - 0.5) * SIZE, 1.5, 4) * smooth(Math.abs(v - 0.5) * (farY - nearY), 1, 3);
      return smooth(Math.min(du, dv), 0, 3) * bars;
    });
    lighting.addLight('moon-patch', MOONLIGHT).setOrigin(0).setPosition(patch.x, patch.y).setAlpha(0.6);

    // Луч в воздухе: от стекла до пятна на полу
    const corners = [
      [x, y],
      [x + SIZE, y],
      [x + SIZE, y + SIZE],
      [x + SIZE - NEAR.slide, nearY],
      [x + SIZE - FAR.slide, farY],
      [x - FAR.slide, farY],
    ];
    const shaft = { x: x - FAR.slide - 8, y: y - 8, w: SIZE + FAR.slide + 16, h: farY - y + 16 };
    // Направление луча — от середины окна к середине пятна
    const dir = new Phaser.Math.Vector2(-(NEAR.slide + FAR.slide) / 2, (nearY + farY) / 2 - y - SIZE / 2).normalize();
    makeLightTexture(scene, 'moon-shaft', shaft.w, shaft.h, (px, py) => {
      const sx = px + shaft.x;
      const sy = py + shaft.y;
      // Сколько пикселей до ближайшего края луча (меньше нуля — снаружи)
      let inside = Infinity;
      corners.forEach(([ax, ay], i) => {
        const [bx, by] = corners[(i + 1) % corners.length];
        const d = ((bx - ax) * (sy - ay) - (by - ay) * (sx - ax)) / Math.hypot(bx - ax, by - ay);
        inside = Math.min(inside, d);
      });
      if (inside <= 0) return 0;
      const across = sx * dir.y - sy * dir.x; // поперёк луча — для полосок
      const streaks = 0.75 + 0.25 * Math.sin(across * 0.45) * Math.sin(across * 0.17 + 1);
      const fade = 1 - 0.5 * ((sy - y) / (farY - y)); // у пола луч слабее
      return smooth(inside, 0, 8) * streaks * fade;
    });
    lighting.addLight('moon-shaft', MOONLIGHT).setOrigin(0).setPosition(shaft.x, shaft.y).setAlpha(0.15);
    lighting.addGlow('moon-shaft', MOONLIGHT).setOrigin(0).setPosition(shaft.x, shaft.y).setAlpha(0.1);

    // Пылинки в лунном луче: берём случайные точки, пока не попадём внутрь луча
    const beam = new Phaser.Geom.Polygon(corners.flat());
    scene.fx.motes(
      MOONLIGHT,
      (point) => {
        do {
          point.x = Phaser.Math.FloatBetween(shaft.x, shaft.x + shaft.w);
          point.y = Phaser.Math.FloatBetween(y + SIZE, farY);
        } while (!beam.contains(point.x, point.y));
      },
      24,
    );
  }
}
