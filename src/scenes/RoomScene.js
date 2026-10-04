import Phaser from 'phaser';
import { Ghost } from '../objects/Ghost.js';
import { Lamp } from '../objects/Lamp.js';
import { Person } from '../objects/Person.js';
import { Piano } from '../objects/Piano.js';

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

// Очки страха за каждого напуганного человека
const FEAR_LIGHT_OFF = 1;
const FEAR_BULB_POP = 3;
const FEAR_PIANO_PLAY = 1;
const FEAR_PIANO_SLAM = 3;

// Середина двери — туда убегают люди
const DOOR_X = 72;

export class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene');
  }

  preload() {
    Ghost.preload(this);
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

    // Лампа под потолком и пианино у стены
    this.lamp = new Lamp(this, 300, CEILING_Y, FLOOR_Y);
    this.piano = new Piano(this, 520, FLOOR_Y);
    this.items = [this.lamp, this.piano]; // во что можно вселиться

    // Темнота поверх комнаты, когда свет выключен
    this.darkness = this.add
      .rectangle(0, 0, width, height, COLORS.darkness)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(10);
    this.lamp.events.on('light', (isOn) => {
      this.tweens.add({ targets: this.darkness, alpha: isOn ? 0 : DARK_ALPHA, duration: 80 });
      // Погасший свет пугает только тех, кто стоял в луче
      if (!isOn) this.scarePeople(FEAR_LIGHT_OFF, (p) => this.lamp.lightsUp(p.x));
    });
    // Лопнувшая лампочка пугает всех
    this.lamp.events.on('pop', () => this.scarePeople(FEAR_BULB_POP));
    // Игра на пианино пугает тех, кто рядом, а «бабах» — всех
    this.piano.events.on('play', () =>
      this.scarePeople(FEAR_PIANO_PLAY, (p) => this.piano.canHear(p.x)),
    );
    this.piano.events.on('slam', () => this.scarePeople(FEAR_PIANO_SLAM));

    // Люди
    const walkArea = { minX: 150, maxX: 600, doorX: DOOR_X };
    this.people = [
      new Person(this, { ...walkArea, x: 420, feetY: 314, shirt: 0x4a6a8a, skin: 0xd9a982 }),
      new Person(this, { ...walkArea, x: 540, feetY: 324, shirt: 0x8a4a5a, skin: 0xc28a6a }),
    ];
    this.fear = 0; // очки страха

    // Счётчик очков страха в углу
    this.fearText = this.add
      .text(8, 6, 'Страх: 0', { fontFamily: 'monospace', fontSize: '12px', color: '#9ff0ff' })
      .setDepth(30);

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

    // Предмет, в который можно вселиться прямо сейчас
    const near = this.possessed
      ? null
      : this.items.find((item) => item.isNear(this.ghost.x, this.ghost.y));

    if (JustDown(this.keys.E)) {
      if (this.possessed) {
        // Выйти из предмета
        const item = this.possessed;
        item.setPossessed(false);
        this.possessed = null;
        const out = item.exitPoint;
        this.ghost.exit(item.x, item.y, out.x, out.y);
      } else if (near) {
        near.setPossessed(true);
        this.possessed = near;
        this.ghost.enter(near.x, near.y);
      }
    }

    // Пробел — малое действие, Q — большое
    if (this.possessed) {
      if (JustDown(this.keys.SPACE)) this.possessed.smallAction();
      if (JustDown(this.keys.Q)) this.possessed.bigAction();
    }

    this.items.forEach((item) => item.update(dt));
    this.ghost.update(dt);
    this.people.forEach((p) => p.update(dt));
    this.updateHint(near);
  }

  // Напугать людей в комнате (кроме уже напуганных). who — кого именно
  scarePeople(points, who = () => true) {
    for (const person of this.people) {
      if (who(person) && person.scare()) this.addFear(points, person.headX, person.headY);
    }
  }

  addFear(points, x, y) {
    this.fear += points;
    this.fearText.setText(`Страх: ${this.fear}`);

    // Счётчик коротко «подпрыгивает»
    this.tweens.killTweensOf(this.fearText);
    this.fearText.y = 6;
    this.tweens.add({ targets: this.fearText, y: 3, duration: 80, yoyo: true });

    // «+1» всплывает над головой и тает
    const label = this.add
      .text(x, y, `+${points}`, { fontFamily: 'monospace', fontSize: '10px', color: '#9ff0ff' })
      .setOrigin(0.5, 1)
      .setDepth(30);
    this.tweens.add({
      targets: label,
      y: y - 20,
      alpha: 0,
      duration: 900,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  updateHint(near) {
    let text = '';
    if (this.possessed) text = this.possessed.actionsHint();
    else if (near) text = `E — вселиться в ${near.label}`;
    if (this.hint.text !== text) this.hint.setText(text);
  }
}
