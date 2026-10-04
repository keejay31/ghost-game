import Phaser from 'phaser';

// Цвета комнаты: тёмные, графика пока заглушки
const COLORS = {
  ceiling: 0x0e0b14,
  wall: 0x1c1726,
  wallStripe: 0x221c2e,
  baseboard: 0x3a2e45,
  floor: 0x2a2030,
  floorLine: 0x352838,
  window: 0x0b1a2e,
  windowFrame: 0x3a2e45,
  moon: 0xcfe3ff,
  door: 0x2e2218,
  doorKnob: 0xc9a227,
};

// Высота пола: от этой линии вниз — пол
export const FLOOR_Y = 300;

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene');
  }

  create() {
    const { width, height } = this.scale;

    // Потолок и стена
    this.add.rectangle(0, 0, width, 24, COLORS.ceiling).setOrigin(0);
    this.add.rectangle(0, 24, width, FLOOR_Y - 24, COLORS.wall).setOrigin(0);

    // Полосы обоев
    for (let x = 16; x < width; x += 48) {
      this.add.rectangle(x, 24, 8, FLOOR_Y - 24, COLORS.wallStripe).setOrigin(0);
    }

    // Окно с луной
    this.add.rectangle(440, 70, 104, 104, COLORS.windowFrame).setOrigin(0);
    this.add.rectangle(444, 74, 96, 96, COLORS.window).setOrigin(0);
    this.add.rectangle(510, 92, 14, 14, COLORS.moon).setOrigin(0);
    this.add.rectangle(490, 74, 4, 96, COLORS.windowFrame).setOrigin(0);
    this.add.rectangle(444, 120, 96, 4, COLORS.windowFrame).setOrigin(0);

    // Дверь
    this.add.rectangle(40, 172, 64, FLOOR_Y - 172, COLORS.door).setOrigin(0);
    this.add.rectangle(92, 236, 6, 6, COLORS.doorKnob).setOrigin(0);

    // Плинтус и пол
    this.add.rectangle(0, FLOOR_Y - 6, width, 6, COLORS.baseboard).setOrigin(0);
    this.add.rectangle(0, FLOOR_Y, width, height - FLOOR_Y, COLORS.floor).setOrigin(0);
    for (let x = 0; x < width; x += 64) {
      this.add.rectangle(x, FLOOR_Y, 2, height - FLOOR_Y, COLORS.floorLine).setOrigin(0);
    }
  }
}
