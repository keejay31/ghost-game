import Phaser from 'phaser';
import { makePersonTexture, PERSON_HEIGHT, STEP_FRAMES, WALK_STEP, RUN_STEP } from './personArt.js';

const WALK_SPEED = 30;
const RUN_SPEED = 150;
const RETURN_DELAY = 5000; // через сколько мс человек вернётся после испуга
// Кадров анимации в секунду: за цикл шага человек проходит 4 длины шага — тогда ноги не скользят
const WALK_FPS = (WALK_SPEED / (WALK_STEP * 4)) * STEP_FRAMES;
const RUN_FPS = (RUN_SPEED / (RUN_STEP * 4)) * STEP_FRAMES;
const JUMP = 22; // на сколько подпрыгивает от испуга

// Человек: ходит по комнате, пугается, убегает за дверь и возвращается
export class Person {
  // options: x, feetY, shirt, skin, hair, pants, longHair, minX, maxX, doorX, lamp
  constructor(scene, options) {
    this.scene = scene;
    const { x, ...rest } = options; // x хранится в view, тут — остальное
    Object.assign(this, rest);
    this.state = 'walk'; // walk, idle, scared, flee, gone
    this.dir = -1;
    this.time = Math.random() * 10;
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

    // Кто ниже на экране, тот ближе к нам и рисуется поверх
    this.view = scene.add.container(x, this.feetY, [this.sprite]).setDepth(5 + this.feetY / 1000);
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

  // Идти к цели; вернёт true, когда дошёл
  moveTo(targetX, speed, dt) {
    const dx = targetX - this.view.x;
    if (Math.abs(dx) <= speed * dt) {
      this.view.x = targetX;
      return true;
    }
    this.dir = Math.sign(dx);
    this.view.x += this.dir * speed * dt;
    return false;
  }

  update(dt) {
    this.time += dt;
    let frame = 'idle';

    if (this.state === 'walk') {
      frame = `walk${Math.floor(this.time * WALK_FPS) % STEP_FRAMES}`;
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
      frame = `run${Math.floor(this.time * RUN_FPS) % STEP_FRAMES}`;
      if (this.moveTo(this.doorX, RUN_SPEED, dt)) this.leave();
    }

    // Смотрит туда, куда идёт
    this.view.scaleX = this.dir;
    this.sprite.setFrame(frame);
    this.alarm.setPosition(this.view.x, this.view.y - PERSON_HEIGHT - 8);

    // Тень: при свете лампы тянется в сторону от неё, без света — еле видна
    const away = this.view.x - this.lamp.x;
    const lit = this.lamp.power;
    this.shadow
      .setPosition(this.view.x + away * 0.06 * lit, this.feetY + 1)
      .setDisplaySize(46 + Math.abs(away) * 0.14 * lit, 11)
      .setAlpha((0.3 + 0.35 * lit) * this.view.alpha);
  }

  // Ушёл за дверь, вернётся позже
  leave() {
    this.state = 'gone';
    this.alarm.setVisible(false);
    this.scene.tweens.add({ targets: this.view, alpha: 0, duration: 150 });
    this.scene.time.delayedCall(RETURN_DELAY, () => this.comeBack());
  }

  comeBack() {
    this.alarm.setVisible(false);
    this.view.setPosition(this.doorX, this.feetY);
    this.scene.tweens.add({ targets: this.view, alpha: 1, duration: 300 });
    this.pickTarget();
    this.state = 'walk';
  }
}
