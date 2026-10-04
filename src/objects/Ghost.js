import Phaser from 'phaser';

// Настройки полёта
const ACCEL = 1320; // разгон (от него зависит и макс. скорость)
const DRAG = 7; // торможение: больше — быстрее останавливается
const WIDTH = 20;
const HEIGHT = 24;

export class Ghost {
  // bounds — прямоугольник, из которого призрак не вылетает
  constructor(scene, x, y, bounds) {
    this.scene = scene;
    this.bounds = bounds;
    this.active = true; // false — сидит в предмете
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.time = 0;
    this.lookOffset = 0;

    // Заглушка: светлое тело и два глаза
    const body = scene.add.rectangle(0, 0, WIDTH, HEIGHT, 0xdde8ff).setAlpha(0.85);
    this.eyeL = scene.add.rectangle(-4, -4, 3, 4, 0x0e0b14);
    this.eyeR = scene.add.rectangle(4, -4, 3, 4, 0x0e0b14);
    this.view = scene.add.container(x, y, [body, this.eyeL, this.eyeR]).setDepth(20);

    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  // Нырнуть в предмет в точке (x, y)
  enter(x, y) {
    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.scene.tweens.killTweensOf(this.view);
    this.scene.tweens.add({ targets: this.view, x, y, scale: 0.2, alpha: 0, duration: 150 });
  }

  // Вылететь из предмета: из (fromX, fromY) в (toX, toY)
  exit(fromX, fromY, toX, toY) {
    this.x = toX;
    this.y = toY;
    this.scene.tweens.killTweensOf(this.view);
    this.view.setPosition(fromX, fromY).setScale(0.2).setAlpha(0);
    this.scene.tweens.add({
      targets: this.view,
      x: toX,
      y: toY,
      scale: 1,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.active = true;
      },
    });
  }

  update(dt) {
    if (!this.active) return;
    const k = this.keys;

    // Куда жмёт игрок: -1, 0 или 1 по каждой оси
    let ix = Number(k.RIGHT.isDown || k.D.isDown) - Number(k.LEFT.isDown || k.A.isDown);
    let iy = Number(k.DOWN.isDown || k.S.isDown) - Number(k.UP.isDown || k.W.isDown);

    // По диагонали не быстрее, чем прямо
    if (ix !== 0 && iy !== 0) {
      ix *= Math.SQRT1_2;
      iy *= Math.SQRT1_2;
    }

    // Плавный разгон и торможение
    this.vx += ix * ACCEL * dt;
    this.vy += iy * ACCEL * dt;
    const drag = Math.exp(-DRAG * dt);
    this.vx *= drag;
    this.vy *= drag;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Не вылетать из комнаты
    const b = this.bounds;
    const minX = b.left + WIDTH / 2;
    const maxX = b.right - WIDTH / 2;
    const minY = b.top + HEIGHT / 2;
    const maxY = b.bottom - HEIGHT / 2;
    if (this.x < minX || this.x > maxX) this.vx = 0;
    if (this.y < minY || this.y > maxY) this.vy = 0;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    this.y = Phaser.Math.Clamp(this.y, minY, maxY);

    // Глаза смотрят туда, куда летим
    if (this.vx > 10) this.lookOffset = 2;
    else if (this.vx < -10) this.lookOffset = -2;
    this.eyeL.x = -4 + this.lookOffset;
    this.eyeR.x = 4 + this.lookOffset;

    // Покачивание в воздухе
    this.time += dt;
    const bob = Math.sin(this.time * 3) * 2;
    this.view.setPosition(Math.round(this.x), Math.round(this.y + bob));
  }
}
