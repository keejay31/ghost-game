import Phaser from 'phaser';
import { makeArt } from '../fx/pixelArt.js';

// Цвета комнаты при полном свете (темноту добавляет освещение)
const C = {
  ceiling: 0x2e2638,
  ceilingLine: 0x221b2b,
  trim: 0x6e5a80, // карниз, рейка, плинтус
  trimLight: 0x8c76a2,
  trimDark: 0x433456,
  paperA: 0x5b4a72, // обои: две полосы
  paperB: 0x64527c,
  paperLine: 0x6f5c88,
  motif: 0x7a6694,
  motifDark: 0x4d3e62,
  paperEdge: 0x3a2c4c, // тень от рваного края обоев
  brick: 0x7c4c40,
  brickDark: 0x693d36,
  mortar: 0x45303a,
  crack: 0x2c2038,
  stile: 0x523d5c, // деревянные панели внизу стены
  panel: 0x473450,
  panelLight: 0x5f4a6a,
  panelDark: 0x33243b,
  planks: [0x7a5440, 0x71493a, 0x835b45, 0x6a4636],
  plankGap: 0x35211d,
  plankLight: 0x9a7252,
  door: 0x6e4a34,
  doorPanel: 0x664430,
  doorLight: 0x8c6246,
  doorDark: 0x4a3023,
  doorGap: 0x1a1014,
  casing: 0x54372b,
  brass: 0xd9ae38,
  brassLight: 0xfff2a8,
  brassDark: 0x8f6a1e,
  frame: 0xa8823a, // рама портрета
  frameLight: 0xe0bc60,
  frameDark: 0x6a4c1c,
  canvas: 0x33414a,
  web: 0xcfc6dd,
};

const STRIPE = 16; // ширина полосы обоев

const DIAMOND = ['...x...', '..xxx..', '.xx.xx.', 'xx...xx', '.xx.xx.', '..xxx..', '...x...'];

const KNOB = ['.dOOd.', 'dOHHOd', 'OOHOOO', 'OOOOOd', 'dOOOdd', '.dddd.'];

// Портрет: h — волосы, f — лицо, e — глаза, m — рот, n — шея, w — воротник, d — платье, b — пуговица
const PORTRAIT = [
  '......hhhhhh......',
  '.....hhhhhhhh.....',
  '....hhhhhhhhhh....',
  '....hhffffffhh....',
  '....hffffffffh....',
  '....hfeeffeefh....',
  '....hfeeffeefh....',
  '....hffffffffh....',
  '....hffffffffh....',
  '.....ffmmmmff.....',
  '.....ffffffff.....',
  '......ffffff......',
  '.......nnnn.......',
  '.......nnnn.......',
  '.....wwnnnnww.....',
  '...ddwwwnnwwwdd...',
  '..ddddwwwwwwdddd..',
  '.dddddddwwddddddd.',
  'dddddddddddddddddd',
  'dddddddddbdddddddd',
  'dddddddddddddddddd',
  'dddddddddbdddddddd',
  'dddddddddddddddddd',
  'dddddddddbdddddddd',
  ...Array(6).fill('dddddddddddddddddd'),
];
const PORTRAIT_COLORS = {
  h: 0x1c1418,
  f: 0xb9ad98,
  e: 0x16101a,
  m: 0x6a4a4a,
  n: 0x9a8f7c,
  w: 0xd8d2c4,
  d: 0x2c2434,
  b: 0x8a7a50,
};

// Нарисовать комнату одной картинкой и поставить её на сцену
export function paintRoom(scene, floorY, ceilingY) {
  const { width, height } = scene.scale;
  // «Случайность» с постоянным зерном: пятна и доски одинаковые при каждом запуске
  const rnd = new Phaser.Math.RandomDataGenerator(['room']);

  makeArt(scene, 'room', width, height, (b) => {
    paintWall(b, rnd, width, ceilingY, floorY);
    paintCeiling(b, rnd, width, ceilingY);
    paintFloor(b, rnd, width, floorY);
    paintDoor(b, rnd, 40, 172, 64, floorY - 172);
    paintPortrait(b, 176, 146);
    paintCobweb(b, 0, ceilingY, 1);
    paintCobweb(b, width - 1, ceilingY, -1);
  });
  scene.add.image(0, 0, 'room').setOrigin(0);
}

function paintWall(b, rnd, width, top, bottom) {
  const railY = bottom - 74; // рейка между обоями и деревянными панелями

  // Обои: полосы с ромбиками и точками
  for (let x = 0; x < width; x += STRIPE * 2) {
    b.rect(x, top, STRIPE, railY - top, C.paperA);
    b.rect(x + STRIPE, top, STRIPE, railY - top, C.paperB);
    b.rect(x + STRIPE, top, 1, railY - top, C.paperLine);
    b.rect(x + STRIPE * 2 - 1, top, 1, railY - top, C.paperLine);
    const shift = (x / (STRIPE * 2)) % 2 ? 14 : 0; // ромбики через полосу сдвинуты
    for (let y = top + 12 + shift; y < railY - 10; y += 28) b.stamp(x + 5, y, DIAMOND, { x: C.motif });
    for (let y = top + 8; y < railY - 2; y += 14) b.dot(x + STRIPE + 8, y, C.motifDark);
  }

  // Грязные пятна
  for (let i = 0; i < 46; i++) {
    const cx = rnd.between(0, width);
    const cy = rnd.between(top, railY);
    const size = rnd.between(4, 16);
    for (let j = 0; j < 6; j++) {
      const w = rnd.between(2, size);
      b.rect(cx + rnd.between(-size, size), cy + rnd.between(-size, size), w, rnd.between(2, size), 0x000000, 0.05);
    }
  }

  // Дыры в обоях (за ними кирпичи) и трещины
  paintTornPaper(b, rnd, 372, 196, 12);
  paintTornPaper(b, rnd, 592, 62, 11);
  paintTornPaper(b, rnd, 130, 66, 10);
  paintCrack(b, rnd, 250, top + 5, 46);
  paintCrack(b, rnd, 566, top + 5, 30);
  paintCrack(b, rnd, 24, 120, 38);

  // Тень под карнизом
  for (let i = 0; i < 6; i++) b.rect(0, top + i, width, 1, 0x000000, 0.3 - i * 0.05);

  // Деревянные панели внизу стены: углублённые, с тенью сверху-слева и бликом снизу-справа
  const panelTop = railY + 4;
  const panelH = bottom - 6 - panelTop;
  b.rect(0, panelTop, width, panelH, C.stile);
  for (let x = 4; x < width; x += 40) {
    b.rect(x, panelTop + 6, 32, panelH - 12, C.panelLight);
    b.rect(x, panelTop + 6, 31, panelH - 13, C.panelDark);
    b.rect(x + 1, panelTop + 7, 30, panelH - 14, C.panel);
    for (let i = 0; i < 5; i++) {
      b.rect(x + rnd.between(2, 29), panelTop + rnd.between(8, 30), 1, rnd.between(6, 18), 0x000000, 0.1);
    }
  }

  // Рейка над панелями и тень под ней
  b.rect(0, railY, width, 4, C.trim);
  b.rect(0, railY, width, 1, C.trimLight);
  b.rect(0, railY + 3, width, 1, C.trimDark);
  b.rect(0, railY + 4, width, 2, 0x000000, 0.25);

  // Плинтус
  b.rect(0, bottom - 6, width, 6, C.trim);
  b.rect(0, bottom - 6, width, 1, C.trimLight);
  b.rect(0, bottom - 1, width, 1, C.trimDark);
}

// Дыра в обоях, за ней — кирпичная кладка
function paintTornPaper(b, rnd, cx, cy, size) {
  const circles = [];
  for (let i = 0; i < 5; i++) {
    circles.push({
      x: cx + rnd.between(-size, size),
      y: cy + rnd.between(-size / 2, size / 2),
      r: rnd.between(size / 3, size / 1.4),
    });
  }
  const inside = (x, y) => circles.some((c) => Math.hypot(x - c.x, y - c.y) < c.r);

  for (let y = cy - size * 2; y <= cy + size * 2; y++) {
    for (let x = cx - size * 3; x <= cx + size * 3; x++) {
      if (!inside(x, y)) continue;
      const row = Math.floor(y / 5);
      const bx = x + (row % 2) * 6; // ряды кирпичей сдвинуты через один
      let color = (row + Math.floor(bx / 12)) % 3 ? C.brick : C.brickDark;
      if (y % 5 === 0 || bx % 12 === 0) color = C.mortar;
      if (!inside(x, y - 1) || !inside(x - 1, y)) color = C.paperEdge;
      b.dot(x, y, color);
    }
  }
}

// Трещина: ломаная линия вниз, иногда ветвится
function paintCrack(b, rnd, x, y, length) {
  for (let i = 0; i < length; i++) {
    b.dot(x, y + i, C.crack, 0.8);
    if (rnd.frac() < 0.4) x += rnd.pick([-1, 1]);
    if (length > 12 && rnd.frac() < 0.07) paintCrack(b, rnd, x, y + i, Math.floor(length / 3));
  }
}

function paintCeiling(b, rnd, width, bottom) {
  // Доски в два ряда
  b.rect(0, 0, width, bottom, C.ceiling);
  b.rect(0, 9, width, 1, C.ceilingLine);
  for (const rowY of [0, 10]) {
    for (let x = rnd.between(20, 70); x < width; x += rnd.between(50, 110)) b.rect(x, rowY, 1, 9, C.ceilingLine);
  }

  // Карниз с «зубчиками»
  b.rect(0, bottom - 5, width, 5, C.trim);
  b.rect(0, bottom - 5, width, 1, C.trimLight);
  b.rect(0, bottom - 1, width, 1, C.trimDark);
  for (let x = 2; x < width; x += 8) b.rect(x, bottom - 3, 4, 2, C.trimDark);
}

function paintFloor(b, rnd, width, top) {
  let y = top;
  // Ряды досок: чем ближе к нам, тем шире
  for (const rowH of [9, 12, 16, 23]) {
    let x = -rnd.between(0, 60);
    while (x < width) {
      const len = rnd.between(70, 150);
      b.rect(x, y, len, rowH, rnd.pick(C.planks));
      // Волокна дерева
      for (let i = 0; i < len / 10; i++) {
        const grain = rnd.pick([0x000000, 0xffffff]);
        b.rect(x + rnd.between(2, len - 16), y + rnd.between(2, rowH - 2), rnd.between(5, 14), 1, grain, 0.07);
      }
      // Стык досок и гвозди
      b.rect(x + len - 1, y, 1, rowH, C.plankGap);
      b.dot(x + 3, y + 3, C.plankGap);
      b.dot(x + len - 5, y + 3, C.plankGap);
      x += len;
    }
    // Щель между рядами и блик на кромке
    b.rect(0, y, width, 1, C.plankGap);
    b.rect(0, y + 1, width, 1, C.plankLight, 0.35);
    y += rowH;
  }
  // Тень под плинтусом
  b.rect(0, top, width, 3, 0x000000, 0.3);
}

function paintDoor(b, rnd, x, y, w, h) {
  // Наличник и тёмная щель вокруг двери
  b.rect(x - 5, y - 5, w + 10, h + 5, C.casing);
  b.rect(x - 5, y - 5, w + 10, 1, C.doorLight);
  b.rect(x - 5, y - 5, 1, h + 5, C.doorLight);
  b.rect(x + w + 4, y - 5, 1, h + 5, C.doorDark);
  b.rect(x - 1, y - 1, w + 2, h + 1, C.doorGap);

  // Полотно двери, внизу щель
  b.rect(x, y, w, h - 2, C.door);
  for (let i = 0; i < 16; i++) {
    b.rect(x + rnd.between(1, w - 2), y + rnd.between(0, h - 24), 1, rnd.between(8, 20), 0x000000, 0.08);
  }

  // Четыре филёнки: углублены, тень сверху-слева, блик снизу-справа
  for (const [px, py, pw, ph] of [[6, 8, 22, 44], [36, 8, 22, 44], [6, 66, 22, 52], [36, 66, 22, 52]]) {
    b.rect(x + px, y + py, pw, ph, C.doorLight);
    b.rect(x + px, y + py, pw - 1, ph - 1, C.doorDark);
    b.rect(x + px + 1, y + py + 1, pw - 2, ph - 2, C.doorPanel);
  }

  // Ручка
  b.stamp(x + 53, y + 56, KNOB, { O: C.brass, H: C.brassLight, d: C.brassDark });
}

function paintPortrait(b, x, y) {
  // Гвоздь и верёвка
  b.line(x + 18, y - 9, x + 7, y, C.frameDark);
  b.line(x + 18, y - 9, x + 29, y, C.frameDark);
  b.dot(x + 18, y - 10, C.brassLight);

  // Тень на стене, рама, холст
  b.rect(x + 2, y + 3, 36, 46, 0x000000, 0.3);
  b.rect(x, y, 36, 46, C.frameDark);
  b.rect(x, y, 35, 45, C.frameLight);
  b.rect(x + 1, y + 1, 34, 44, C.frame);
  b.rect(x + 4, y + 4, 28, 38, C.frameLight);
  b.rect(x + 4, y + 4, 27, 37, C.frameDark);
  b.rect(x + 5, y + 5, 26, 36, C.canvas);
  b.stamp(x + 9, y + 11, PORTRAIT, PORTRAIT_COLORS);
}

// Паутина в углу под потолком: side = 1 — левый угол, -1 — правый
function paintCobweb(b, x, y, side) {
  const angles = [3, 28, 54, 80].map(Phaser.Math.DegToRad);
  const tip = (angle, r) => [x + side * Math.cos(angle) * r, y + Math.sin(angle) * r];

  for (const angle of angles) b.line(x, y, ...tip(angle, 46), C.web, 0.4);
  // Нити между лучами провисают к углу
  for (const r of [12, 22, 32, 42]) {
    for (let i = 0; i < angles.length - 1; i++) {
      const middle = tip((angles[i] + angles[i + 1]) / 2, r * 0.84);
      b.line(...tip(angles[i], r), ...middle, C.web, 0.3);
      b.line(...middle, ...tip(angles[i + 1], r), C.web, 0.3);
    }
  }
}
