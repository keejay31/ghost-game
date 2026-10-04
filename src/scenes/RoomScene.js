import Phaser from 'phaser';
import { Ghost } from '../objects/Ghost.js';
import { Lamp } from '../objects/Lamp.js';

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
  darkness: 0x05030a,
};

// Высота пола: от этой линии вниз — пол
export const FLOOR_Y = 300;
const CEILING_Y = 24;

// Насколько темно без света (0 — светло, 1 — чёрный экран)
const DARK_ALPHA = 0.6;

// На каком расстоянии от лампы можно в неё вселиться
const POSSESS_DISTANCE = 36;

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
    // Луна видна и в темноте
    this.add.rectangle(510, 92, 14, 14, COLORS.moon).setOrigin(0).setDepth(11);
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

    // Лампа под потолком
    this.lamp = new Lamp(this, 300, CEILING_Y, FLOOR_Y);

    // Темнота поверх комнаты, когда свет выключен
    this.darkness = this.add
      .rectangle(0, 0, width, height, COLORS.darkness)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(10);
    this.lamp.events.on('light', (isOn) => {
      this.tweens.add({ targets: this.darkness, alpha: isOn ? 0 : DARK_ALPHA, duration: 80 });
    });

    // Призрак: летает от потолка до пола
    const flyZone = new Phaser.Geom.Rectangle(0, CEILING_Y, width, FLOOR_Y - CEILING_Y);
    this.ghost = new Ghost(this, 200, 180, flyZone);
    this.possessed = null; // в каком предмете сидит призрак

    this.keys = this.input.keyboard.addKeys('E,SPACE,Q');

    // Подсказка внизу экрана
    this.hint = this.add
      .text(width / 2, 340, '', { fontFamily: 'monospace', fontSize: '10px', color: '#cfc6dd' })
      .setOrigin(0.5)
      .setDepth(30);
  }

  update(time, delta) {
    // Время кадра в секундах (не больше 0.05, чтобы не «телепортироваться» после паузы)
    const dt = Math.min(delta / 1000, 0.05);
    const JustDown = Phaser.Input.Keyboard.JustDown;
    const lamp = this.lamp;

    const nearLamp =
      Phaser.Math.Distance.Between(this.ghost.x, this.ghost.y, lamp.x, lamp.y) < POSSESS_DISTANCE;

    if (JustDown(this.keys.E)) {
      if (this.possessed) {
        // Выйти из лампы — вылетаем под неё
        lamp.setPossessed(false);
        this.possessed = null;
        this.ghost.exit(lamp.x, lamp.y, lamp.x, lamp.y + 34);
      } else if (nearLamp) {
        lamp.setPossessed(true);
        this.possessed = lamp;
        this.ghost.enter(lamp.x, lamp.y);
      }
    }

    if (this.possessed === lamp) {
      if (JustDown(this.keys.SPACE)) lamp.toggle();
      if (JustDown(this.keys.Q)) lamp.pop();
    }

    lamp.update(dt);
    this.ghost.update(dt);
    this.updateHint(nearLamp);
  }

  updateHint(nearLamp) {
    let text = '';
    if (this.possessed) {
      text = this.lamp.isBroken ? 'E — выйти' : 'Пробел — свет    Q — лопнуть    E — выйти';
    } else if (nearLamp) {
      text = 'E — вселиться в лампу';
    }
    if (this.hint.text !== text) this.hint.setText(text);
  }
}
