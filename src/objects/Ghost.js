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
const GLOW = 0x66c2fd; // призрак светится своим цветом
const PEEK_SCALE = 2; // во сколько раз призрак больше, когда высовывается из предмета

// Призрак на 15% больше рисунка автора: эти столбцы и ряды пикселей рисуются дважды.
// Выбраны так, чтобы глаза и рот остались такими же, а раздвинулось всё вокруг них
const WIDER = [8, 12, 15, 19];
const TALLER = [3, 10, 16, 21];

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
    this.sprite = new GhostSprite(scene, 'ghost-front', 'ghost-anim', WIDER, TALLER);
    this.view = scene.add.image(x, y, this.sprite.key).setDepth(20);
    this.facing = 0; // -1 — смотрит влево, 1 — вправо, 0 — на нас
    this.look = 0; // текущий сдвиг лица
    this.lookTimer = 0;
    this.blinkIn = Phaser.Math.FloatBetween(2, 5); // через сколько секунд моргнуть
    this.blinkLeft = 0; // сколько ещё глаза закрыты

    // Призрак светится: освещает всё вокруг себя и окружён ореолом
    this.light = scene.lighting.addLight('light-soft', GLOW);
    this.aura = scene.lighting.addGlow('light-soft', GLOW);
    this.glowTime = 0;
    this.trailDue = 0; // сколько огоньков следа пора выпустить
    this.flare = 0; // вспышка света (после «БУ!»), гаснет сама
    this.imageIn = 0; // через сколько секунд оставить отпечаток

    this.keys = scene.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT');
  }

  // Нырнуть в предмет в точке (x, y)
  enter(x, y) {
    this.active = false;
    this.vx = 0;
    this.vy = 0;
    this.scene.tweens.killTweensOf(this.view);
    this.scene.tweens.add({ targets: this.view, x, y, scale: 0.2, alpha: 0, duration: 150 });
    this.scene.fx.swirlIn(x, y);
  }

  // Вылететь из предмета: из (fromX, fromY) в (toX, toY)
  exit(fromX, fromY, toX, toY) {
    this.x = toX;
    this.y = toY;
    this.scene.tweens.killTweensOf(this.view);
    this.view.setCrop().setPosition(fromX, fromY).setScale(0.2).setAlpha(0);
    this.scene.fx.burst(fromX, fromY);
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

  // Высунуться по пояс из предмета в точке (x, y) и спрятаться обратно
  peek(x, y) {
    const view = this.view;
    this.sprite.draw(0, 0, 0, false); // смотрит прямо на нас
    this.flare = 1;
    this.scene.tweens.killTweensOf(view);
    // Видна только верхняя часть — хвост остаётся внутри
    view.setCrop(0, 0, view.width, Math.round(view.height * 0.62));
    view.setPosition(x, y + 8).setScale(0.5).setAlpha(1);
    this.scene.tweens.add({
      targets: view,
      scale: PEEK_SCALE,
      duration: 110,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: view,
          scale: 0.3,
          alpha: 0,
          delay: 450,
          duration: 140,
          ease: 'Quad.easeIn',
          onComplete: () => view.setCrop().setPosition(x, y).setScale(0.2),
        });
      },
    });
  }

  update(dt) {
    if (this.active) this.fly(dt);

    // Свет летит за призраком и медленно «дышит». Внутри предмета — светит из него
    this.glowTime += dt;
    this.flare *= Math.exp(-dt * 4);
    const pulse = 1 + 0.06 * Math.sin(this.glowTime * 2.2) + this.flare;
    this.light.setPosition(this.view.x, this.view.y).setScale(1.5 * pulse).setAlpha(0.85);
    this.aura
      .setPosition(this.view.x, this.view.y)
      .setScale(0.55 * pulse)
      .setAlpha(0.15 + 0.15 * this.view.alpha + 0.3 * this.flare);
  }

  fly(dt) {
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

    // Светящийся след: чем быстрее летит, тем гуще
    const speed = Math.hypot(this.vx, this.vy);
    this.trailDue += dt * (4 + speed / 3);
    while (this.trailDue >= 1) {
      this.trailDue -= 1;
      this.scene.fx.trail(this.view.x + Phaser.Math.Between(-7, 7), this.view.y + Phaser.Math.Between(0, 12));
    }
    // На большой скорости за призраком остаются тающие отпечатки
    this.imageIn -= dt;
    if (speed > MAX_SPEED * 0.6 && this.imageIn <= 0) {
      this.scene.fx.afterimage(this.view, GLOW);
      this.imageIn = 0.06;
    }
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
