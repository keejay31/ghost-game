import Phaser from 'phaser';

const WALK_SPEED = 30;
const RUN_SPEED = 150;
const RETURN_DELAY = 5000; // через сколько мс человек вернётся после испуга

// Человек: ходит по комнате, пугается, убегает за дверь и возвращается
export class Person {
  // options: x, feetY, shirt, skin, minX, maxX, doorX
  constructor(scene, options) {
    this.scene = scene;
    Object.assign(this, options);
    this.state = 'walk'; // walk, idle, scared, flee, gone
    this.dir = -1;
    this.time = Math.random() * 10;
    this.pickTarget();

    // Заглушка: туловище, голова, волосы, глаз, рот
    const body = scene.add.rectangle(0, 0, 14, 22, this.shirt).setOrigin(0.5, 1);
    const head = scene.add.rectangle(0, -22, 10, 10, this.skin).setOrigin(0.5, 1);
    const hair = scene.add.rectangle(-1, -30, 12, 3, 0x1a1210).setOrigin(0.5, 1);
    const eye = scene.add.rectangle(2, -26, 2, 2, 0x0e0b14);
    this.mouth = scene.add.rectangle(3, -23, 3, 3, 0x0e0b14).setVisible(false);
    this.alarm = scene.add
      .text(0, -36, '!', { fontFamily: 'monospace', fontSize: '12px', color: '#ffe066' })
      .setOrigin(0.5, 1)
      .setVisible(false);

    this.view = scene.add
      .container(this.x, this.feetY, [body, head, hair, eye, this.mouth, this.alarm])
      .setDepth(5);
  }

  // Точка над «!» — для «+1»
  get headX() {
    return this.view.x;
  }
  get headY() {
    return this.feetY - 52;
  }

  canBeScared() {
    return this.state === 'walk' || this.state === 'idle';
  }

  // Испугаться: подпрыгнуть и убежать. Вернёт true, если испугался
  scare() {
    if (!this.canBeScared()) return false;
    this.state = 'scared';
    this.alarm.setVisible(true);
    this.mouth.setVisible(true);
    this.scene.tweens.add({
      targets: this.view,
      y: this.feetY - 12,
      duration: 120,
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
    let bounce = 0;

    if (this.state === 'walk') {
      bounce = Math.abs(Math.sin(this.time * 8));
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
    } else if (this.state === 'flee') {
      bounce = Math.abs(Math.sin(this.time * 16)) * 2;
      if (this.moveTo(this.doorX, RUN_SPEED, dt)) this.leave();
    }

    // Смотрит туда, куда идёт
    this.view.scaleX = this.dir;
    if (this.state !== 'scared' && this.state !== 'gone') {
      this.view.y = Math.round(this.feetY - bounce);
    }
  }

  // Ушёл за дверь, вернётся позже
  leave() {
    this.state = 'gone';
    this.scene.tweens.add({ targets: this.view, alpha: 0, duration: 150 });
    this.scene.time.delayedCall(RETURN_DELAY, () => this.comeBack());
  }

  comeBack() {
    this.alarm.setVisible(false);
    this.mouth.setVisible(false);
    this.view.setPosition(this.doorX, this.feetY);
    this.scene.tweens.add({ targets: this.view, alpha: 1, duration: 300 });
    this.pickTarget();
    this.state = 'walk';
  }
}
