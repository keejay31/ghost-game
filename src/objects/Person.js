import Phaser from 'phaser';
import { makePersonTexture, PERSON_HEIGHT, STEP_FRAMES, WALK_STEP, RUN_STEP } from './personArt.js';

const WALK_SPEED = 30;
const RUN_SPEED = 150;
const HALL_SPEED = 60; // шаг, которым человек возвращается через дверь
const RETURN_DELAY = 5000; // через сколько мс человек вернётся после испуга
// Кадров анимации на пиксель пути: за цикл шага человек проходит 4 длины шага — тогда ноги не скользят
const WALK_FRAMES = STEP_FRAMES / (WALK_STEP * 4);
const RUN_FRAMES = STEP_FRAMES / (RUN_STEP * 4);
const JUMP = 22; // на сколько подпрыгивает от испуга

// Дверь
const OPEN_AHEAD = 90; // за сколько пикселей до двери она распахивается перед бегущим
const DOOR_SIDE = 24; // на сколько правее середины двери человек сворачивает в проём
const HALL_SIZE = 0.92; // в проёме человек дальше от нас — чуть меньше
const HALL_TINT = 0xb4aec4; // и в тени

// Человек: ходит по комнате, пугается, убегает за дверь и возвращается
export class Person {
  // options: x, feetY, shirt, skin, hair, pants, longHair, minX, maxX, door, lamp
  constructor(scene, options) {
    this.scene = scene;
    const { x, ...rest } = options; // x хранится в view, тут — остальное
    Object.assign(this, rest);
    // walk, idle — гуляет; scared, flee — испугался и бежит к двери;
    // exit, hallOut — через порог и по коридору; gone — убежал; hallIn, enter — возвращается
    this.state = 'walk';
    this.dir = -1;
    this.time = Math.random() * 10;
    this.depth = 5 + this.feetY / 1000; // кто ниже на экране, тот ближе к нам и рисуется поверх
    this.inHall = false; // в коридоре за дверью
    this.holdsDoor = false; // дверь открыта для него
    this.pickTarget();

    // Тень на полу
    this.shadow = scene.add.image(x, this.feetY, 'light-soft').setTint(0x000000).setDepth(4);

    // Картинка со всеми позами (у каждой расцветки — своя)
    const key = `person-${this.shirt}-${this.skin}`;
    makePersonTexture(scene, key, {
      shirt: this.shirt,
      skin: this.skin,
      hair: this.hair,
      pants: this.pants,
      longHair: this.longHair,
    });
    this.sprite = scene.add.image(0, 1, key, 'idle').setOrigin(0.5, 1);
    // «!» рисуется поверх темноты — его видно и без света
    this.alarm = scene.add
      .text(0, 0, '!', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe066' })
      .setOrigin(0.5, 1)
      .setDepth(15)
      .setVisible(false);

    this.view = scene.add.container(x, this.feetY, [this.sprite]).setDepth(this.depth);
  }

  get x() {
    return this.view.x;
  }

  // Точка над «!» — для «+1»
  get headX() {
    return this.view.x;
  }
  get headY() {
    return this.feetY - PERSON_HEIGHT - JUMP - 30;
  }

  canBeScared() {
    return this.state === 'walk' || this.state === 'idle';
  }

  // Испугаться: подпрыгнуть и убежать. Вернёт true, если испугался
  scare() {
    if (!this.canBeScared()) return false;
    this.state = 'scared';
    this.alarm.setVisible(true);
    this.scene.tweens.add({
      targets: this.view,
      y: this.feetY - JUMP,
      duration: 140,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.state = 'flee';
      },
    });
    return true;
  }

  pickTarget() {
    this.targetX = Phaser.Math.Between(this.minX, this.maxX);
  }

  // Идти к точке; вернёт true, когда дошёл
  moveTo(targetX, speed, dt, targetY = this.view.y) {
    const dx = targetX - this.view.x;
    const dy = targetY - this.view.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= speed * dt) {
      this.view.setPosition(targetX, targetY);
      return true;
    }
    if (dx !== 0) this.dir = Math.sign(dx);
    this.view.x += (dx / dist) * speed * dt;
    this.view.y += (dy / dist) * speed * dt;
    return false;
  }

  // Кадр шага или бега: зависит от пройденного времени и скорости
  stepFrame(name, framesPerPixel, speed) {
    return `${name}${Math.floor(this.time * framesPerPixel * speed) % STEP_FRAMES}`;
  }

  update(dt) {
    this.time += dt;
    const door = this.door;
    let frame = 'idle';

    if (this.state === 'walk') {
      frame = this.stepFrame('walk', WALK_FRAMES, WALK_SPEED);
      if (this.moveTo(this.targetX, WALK_SPEED, dt)) {
        this.state = 'idle';
        this.idleTime = Phaser.Math.FloatBetween(0.5, 2);
      }
    } else if (this.state === 'idle') {
      this.idleTime -= dt;
      if (this.idleTime <= 0) {
        this.pickTarget();
        this.state = 'walk';
      }
    } else if (this.state === 'scared') {
      frame = 'scared';
    } else if (this.state === 'flee') {
      // Бежит к двери, она распахивается заранее
      frame = this.stepFrame('run', RUN_FRAMES, RUN_SPEED);
      if (this.view.x - door.x < OPEN_AHEAD) this.holdDoor(true);
      if (this.moveTo(door.x + DOOR_SIDE, RUN_SPEED, dt)) this.state = 'exit';
    } else if (this.state === 'exit') {
      // Сворачивает в проём, через порог
      frame = this.stepFrame('run', RUN_FRAMES, RUN_SPEED);
      if (this.moveTo(door.x, RUN_SPEED, dt, door.sillY)) {
        this.setInHall(true);
        this.state = 'hallOut';
      }
    } else if (this.state === 'hallOut') {
      // По коридору налево, пока не скроется за косяком
      frame = this.stepFrame('run', RUN_FRAMES, RUN_SPEED);
      if (this.moveTo(door.hallX, RUN_SPEED, dt)) this.leave();
    } else if (this.state === 'hallIn') {
      // Возвращается: по коридору к проёму
      frame = this.stepFrame('walk', WALK_FRAMES, HALL_SPEED);
      if (this.moveTo(door.x, HALL_SPEED, dt)) {
        this.setInHall(false);
        this.state = 'enter';
      }
    } else if (this.state === 'enter') {
      // Через порог в комнату, дверь за ним закрывается
      frame = this.stepFrame('walk', WALK_FRAMES, HALL_SPEED);
      if (this.moveTo(door.x + DOOR_SIDE, HALL_SPEED, dt, this.feetY)) {
        this.holdDoor(false);
        this.pickTarget();
        this.state = 'walk';
      }
    }

    // У двери человек отходит от нас к стене — и становится чуть меньше
    let size = 1;
    if (this.state !== 'scared' && this.view.y < this.feetY) {
      size = Phaser.Math.Linear(1, HALL_SIZE, (this.feetY - this.view.y) / (this.feetY - door.sillY));
    }
    // Смотрит туда, куда идёт
    this.view.setScale(this.dir * size, size);
    this.sprite.setFrame(frame);
    this.alarm.setPosition(this.view.x, this.view.y - PERSON_HEIGHT - 8);

    // Тень: при свете лампы тянется в сторону от неё, без света — еле видна
    const away = this.view.x - this.lamp.x;
    const lit = this.lamp.power;
    const groundY = this.state === 'scared' ? this.feetY : this.view.y;
    this.shadow
      .setPosition(this.view.x + away * 0.06 * lit, groundY + 1)
      .setDisplaySize(46 + Math.abs(away) * 0.14 * lit, 11)
      .setAlpha(this.inHall ? 0 : 0.3 + 0.35 * lit);
  }

  // Попросить дверь открыться (true) или отпустить её (false). slam — захлопнуть с грохотом
  holdDoor(value, slam = false) {
    if (value === this.holdsDoor) return;
    this.holdsDoor = value;
    if (value) this.door.use();
    else this.door.done(slam);
  }

  // В коридоре человека видно только через проём двери, и он в тени
  setInHall(value) {
    this.inHall = value;
    if (value) this.view.setMask(this.door.mask).setDepth(0.5);
    else this.view.clearMask().setDepth(this.depth);
    this.sprite.setTint(value ? HALL_TINT : 0xffffff);
    if (value) this.alarm.setVisible(false);
  }

  // Скрылся в коридоре, дверь захлопнулась. Вернётся позже
  leave() {
    this.state = 'gone';
    this.view.setVisible(false);
    this.holdDoor(false, true);
    this.scene.time.delayedCall(RETURN_DELAY, () => this.comeBack());
  }

  // Возвращается: дверь открывается, человек выходит из коридора
  comeBack() {
    this.holdDoor(true);
    this.view.setVisible(true).setPosition(this.door.hallX, this.door.sillY);
    this.state = 'hallIn';
  }
}
