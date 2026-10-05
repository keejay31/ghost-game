import Phaser from 'phaser';
import { Synth } from '../audio/Synth.js';
import { mixColor } from '../fx/Lighting.js';
import { makeArt } from '../fx/pixelArt.js';

// Цвета двери
const WOOD = 0x6e4a34;
const PANEL = 0x664430;
const WOOD_LIGHT = 0x8c6246;
const WOOD_DARK = 0x4a3023;
const CASING = 0x54372b;
const GAP = 0x1a1014;
const BRASS = 0xd9ae38;
const BRASS_LIGHT = 0xfff2a8;
const BRASS_DARK = 0x8f6a1e;
const LEAF_SHADE = 0x8a84a0; // распахнутая створка уходит в тень
// Коридор за дверью: там горит свой тусклый свет
const HALL_WALL = 0x4a3e44;
const HALL_STRIPE = 0x54464c;
const HALL_TRIM = 0x6a5668;
const HALL_FLOOR = 0x5a3e30;
const HALL_LINE = 0x38261e;
const HALL_LIGHT = 0xffc890;

const W = 64; // ширина проёма
const CASING_W = 5; // наличник
const OPEN_WIDTH = 0.2; // какой узкой видна распахнутая створка (1 — во весь проём)
const OPEN_TIME = 0.16; // за сколько секунд дверь распахивается
const CLOSE_TIME = 0.12;

const KNOB = ['.dOOd.', 'dOHHOd', 'OOHOOO', 'OOOOOd', 'dOOOdd', '.dddd.'];

// Нарисовать проём (наличник и коридор за дверью) и створку. h — высота проёма
function paintDoor(scene, h) {
  const rnd = new Phaser.Math.RandomDataGenerator(['door']);

  makeArt(scene, 'doorway', W + CASING_W * 2, h + CASING_W, (b) => {
    const x = CASING_W;
    const y = CASING_W;
    // Наличник и тёмная щель вокруг двери
    b.rect(0, 0, W + CASING_W * 2, h + CASING_W, CASING);
    b.rect(0, 0, W + CASING_W * 2, 1, WOOD_LIGHT);
    b.rect(0, 0, 1, h + CASING_W, WOOD_LIGHT);
    b.rect(W + CASING_W * 2 - 1, 0, 1, h + CASING_W, WOOD_DARK);
    b.rect(x - 1, y - 1, W + 2, h + 1, GAP);

    // Коридор: стена в полоску, плинтус, пол
    b.rect(x, y, W, h, HALL_WALL);
    for (let sx = 8; sx < W; sx += 16) b.rect(x + sx, y, 8, h - 16, HALL_STRIPE);
    b.rect(x, y + h - 16, W, 3, HALL_TRIM);
    b.rect(x, y + h - 13, W, 13, HALL_FLOOR);
    b.rect(x, y + h - 7, W, 1, HALL_LINE);
    // Тень от притолоки и косяков
    for (let i = 0; i < 8; i++) b.rect(x, y + i, W, 1, 0x000000, 0.4 - i * 0.05);
    b.rect(x, y, 3, h, 0x000000, 0.3);
    b.rect(x + W - 3, y, 3, h, 0x000000, 0.3);
  });

  makeArt(scene, 'door-leaf', W, h - 2, (b) => {
    b.rect(0, 0, W, h - 2, WOOD);
    for (let i = 0; i < 16; i++) {
      b.rect(rnd.between(1, W - 2), rnd.between(0, h - 24), 1, rnd.between(8, 20), 0x000000, 0.08);
    }
    // Четыре филёнки: углублены, тень сверху-слева, блик снизу-справа
    for (const [px, py, pw, ph] of [[6, 8, 22, 44], [36, 8, 22, 44], [6, 66, 22, 52], [36, 66, 22, 52]]) {
      b.rect(px, py, pw, ph, WOOD_LIGHT);
      b.rect(px, py, pw - 1, ph - 1, WOOD_DARK);
      b.rect(px + 1, py + 1, pw - 2, ph - 2, PANEL);
    }
    b.stamp(53, 56, KNOB, { O: BRASS, H: BRASS_LIGHT, d: BRASS_DARK });
  });
}

// Дверь в коридор: через неё люди убегают и возвращаются. x — левый край проёма, y — верх
export class Door {
  constructor(scene, x, y, floorY) {
    this.scene = scene;
    this.synth = new Synth(scene);
    const h = floorY - y;

    this.x = x + W / 2; // середина проёма
    this.sillY = floorY - 1; // порог: тут ноги того, кто стоит в проёме
    this.hallX = x - 22; // место в коридоре, которого из комнаты уже не видно
    this.users = 0; // сколько людей сейчас идёт через дверь
    this.openness = 0; // 0 — закрыта, 1 — распахнута
    this.loud = false; // захлопнуть с грохотом

    paintDoor(scene, h);
    scene.add.image(x - CASING_W, y - CASING_W, 'doorway').setOrigin(0);
    // Створка на петлях слева. Рисуется поверх тех, кто идёт по коридору
    this.leaf = scene.add.image(x, y, 'door-leaf').setOrigin(0).setDepth(1);

    // Свет из коридора: виден в проёме и ложится пятном на пол, когда дверь открыта
    this.glow = scene.lighting.addLight('__WHITE', HALL_LIGHT).setOrigin(0).setPosition(x, y).setDisplaySize(W, h);
    this.spill = scene.lighting
      .addLight('light-soft', HALL_LIGHT)
      .setPosition(this.x + 10, floorY + 12)
      .setDisplaySize(150, 56);

    // «Прорезь» в стене: тех, кто в коридоре, видно только через проём
    const hole = scene.make.graphics();
    hole.fillRect(x, y, W, h);
    this.mask = hole.createGeometryMask();
  }

  // Кто-то идёт к двери: открыть и держать открытой, пока не пройдёт
  use() {
    if (this.users === 0) this.synth.creak();
    this.users += 1;
  }

  // Прошёл. Когда никого не осталось, дверь закрывается (loud — с грохотом)
  done(loud) {
    this.users -= 1;
    this.loud = loud;
  }

  update(dt) {
    const before = this.openness;
    if (this.users > 0) this.openness = Math.min(1, before + dt / OPEN_TIME);
    else this.openness = Math.max(0, before - dt / CLOSE_TIME);

    // Распахнутая створка видна узкой полоской и уходит в тень
    this.leaf.scaleX = 1 - (1 - OPEN_WIDTH) * this.openness;
    this.leaf.setTint(mixColor(0xffffff, LEAF_SHADE, this.openness));
    this.glow.setAlpha(this.openness * 0.55);
    this.spill.setAlpha(this.openness * 0.4);

    if (before > 0 && this.openness === 0) this.shut();
  }

  // Дверь закрылась: хлопок, а если с грохотом — ещё дрожь и пыль
  shut() {
    this.synth.slam(this.loud);
    if (!this.loud) return;
    this.scene.cameras.main.shake(100, 0.004);
    this.scene.fx.dust(this.x, this.sillY, W / 2, 5);
  }
}
