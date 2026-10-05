import Phaser from 'phaser';
import { Ghost } from '../objects/Ghost.js';
import { Lamp } from '../objects/Lamp.js';
import { MoonWindow } from '../objects/MoonWindow.js';
import { Person } from '../objects/Person.js';
import { Piano } from '../objects/Piano.js';
import { Portrait } from '../objects/Portrait.js';
import { Lighting, mixColor } from '../fx/Lighting.js';
import { Effects } from '../fx/Effects.js';
import { paintRoom } from './roomArt.js';

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
    const { width } = this.scale;

    // Свет, темнота и эффекты (нужны предметам, поэтому создаются первыми)
    this.lighting = new Lighting(this);
    this.fx = new Effects(this, FLOOR_Y);

    // Стены, пол, потолок и дверь — одной картинкой; окно с луной — отдельно
    paintRoom(this, FLOOR_Y, CEILING_Y);
    new MoonWindow(this, 444, 74, FLOOR_Y);

    // Лампа под потолком, пианино у стены, портрет на стене
    this.lamp = new Lamp(this, 300, CEILING_Y, FLOOR_Y);
    this.piano = new Piano(this, 520, FLOOR_Y);
    this.portrait = new Portrait(this, 200, 102);
    this.items = [this.lamp, this.piano, this.portrait]; // во что можно вселиться

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
    const walkArea = { minX: 150, maxX: 600, doorX: DOOR_X, lamp: this.lamp };
    const blue = { shirt: 0x5a82aa, skin: 0xd9a982, hair: 0x3a2418, pants: 0x3a3650 };
    const red = { shirt: 0xaa5a6e, skin: 0xc28a6a, hair: 0x1a1210, pants: 0x4a3a34, longHair: true };
    this.people = [
      new Person(this, { ...walkArea, ...blue, x: 420, feetY: 314 }),
      new Person(this, { ...walkArea, ...red, x: 540, feetY: 324 }),
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
