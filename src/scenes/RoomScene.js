import Phaser from 'phaser';
import { Ghost } from '../objects/Ghost.js';
import { Lamp } from '../objects/Lamp.js';
import { MoonWindow } from '../objects/MoonWindow.js';
import { Person } from '../objects/Person.js';
import { Piano } from '../objects/Piano.js';
import { Lighting, mixColor } from '../fx/Lighting.js';

// Цвета комнаты при полном свете (темноту добавляет освещение), графика пока заглушки
const COLORS = {
  ceiling: 0x2b2438,
  wall: 0x54466b,
  wallStripe: 0x5f5078,
  baseboard: 0x7a6490,
  floor: 0x6b4c40,
  floorLine: 0x553a32,
  door: 0x6a4a34,
  doorKnob: 0xe6bc3c,
};

// Высота пола: от этой линии вниз — пол
export const FLOOR_Y = 300;
const CEILING_Y = 24;

// Цвет темноты: при свете лампы — по углам, без лампы — во всей комнате
const AMBIENT_LIT = 0x544c6c;
const AMBIENT_DARK = 0x1c2446;

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

    // Свет и темнота (нужны предметам, поэтому создаются первыми)
    this.lighting = new Lighting(this);

    // Потолок и стена
    this.add.rectangle(0, 0, width, 24, COLORS.ceiling).setOrigin(0);
    this.add.rectangle(0, 24, width, FLOOR_Y - 24, COLORS.wall).setOrigin(0);

    // Полосы обоев
    for (let x = 16; x < width; x += 48) {
      this.add.rectangle(x, 24, 8, FLOOR_Y - 24, COLORS.wallStripe).setOrigin(0);
    }

    // Окно с луной
    new MoonWindow(this, 444, 74, FLOOR_Y);

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

    this.lamp.events.on('light', (isOn) => {
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

    // Чем слабее горит лампа, тем темнее в комнате
    this.lighting.setAmbient(mixColor(AMBIENT_DARK, AMBIENT_LIT, this.lamp.power));
    this.lighting.update();
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
