import Phaser from 'phaser';
import ghostFrontUrl from '../assets/ghost-front.png';
import { GhostSprite } from './GhostSprite.js';

// Настройки полёта
const ACCEL = 1320; // разгон (от него зависит и макс. скорость)
const DRAG = 7; // торможение: больше — быстрее останавливается
const MAX_SPEED = ACCEL / DRAG;

// Анимация
const LOOK_PX = 2; // на сколько пикселей лицо поворачивается в сторону
const LEAN_PX = 1.5; // наклон на полной скорости
const WAVE_FPS = 8; // кадров в секунду у волны по хвосту

export class Ghost {
  // Загрузить картинку призрака (вызывать в preload сцены)
  static preload(scene) {
    scene.load.image('ghost-front', ghostFrontUrl);
  }

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

    // Призрак по рисунку автора, с анимацией
    this.sprite = new GhostSprite(scene, 'ghost-front', 'ghost-anim');
    this.view = scene.add.image(x, y, this.sprite.key).setDepth(20);
    this.facing = 0; // -1 — смотрит влево, 1 — вправо, 0 — на нас
    this.look = 0; // текущий сдвиг лица
    this.lookTimer = 0;
    this.blinkIn = Phaser.Math.FloatBetween(2, 5); // через сколько секунд моргнуть
    this.blinkLeft = 0; // сколько ещё глаза закрыты

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
    const halfW = this.sprite.w / 2;
    const halfH = this.sprite.h / 2;
    const minX = b.left + halfW;
    const maxX = b.right - halfW;
    const minY = b.top + halfH;
    const maxY = b.bottom - halfH;
    if (this.x < minX || this.x > maxX) this.vx = 0;
    if (this.y < minY || this.y > maxY) this.vy = 0;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    this.y = Phaser.Math.Clamp(this.y, minY, maxY);

    this.time += dt;
    this.animate(dt);

    // Покачивание в воздухе
    const bob = Math.sin(this.time * 3) * 2;
    this.view.setPosition(Math.round(this.x), Math.round(this.y + bob));
  }

  animate(dt) {
    // Смотрит туда, куда летел последний раз
    if (this.vx > 20) this.facing = 1;
    else if (this.vx < -20) this.facing = -1;

    // Лицо поворачивается по одному пикселю
    this.lookTimer -= dt;
    const targetLook = this.facing * LOOK_PX;
    if (this.look !== targetLook && this.lookTimer <= 0) {
      this.look += Math.sign(targetLook - this.look);
      this.lookTimer = 0.05;
    }

    // Моргание
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.12;
      this.blinkIn = Phaser.Math.FloatBetween(2, 5);
    }
    this.blinkLeft -= dt;

    // Наклон от скорости (шагами по полпикселя) и волна по хвосту
    const leanRaw = Phaser.Math.Clamp(this.vx / MAX_SPEED, -1, 1) * LEAN_PX;
    const lean = (Math.sign(leanRaw) * Math.round(Math.abs(leanRaw) * 2)) / 2;
    const phase = (Math.floor(this.time * WAVE_FPS) % 8) * (Math.PI / 4); // 8 кадров по кругу
    this.sprite.draw(this.look, lean, phase, this.blinkLeft > 0);
  }
}
