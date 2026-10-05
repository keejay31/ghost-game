import Phaser from 'phaser';
import { makeArt } from './pixelArt.js';

// Эффекты из частиц: пылинки в свете, искры, дым, пыль, след призрака, вихрь при вселении.
// Светящиеся частицы рисуются поверх темноты, пыль — под ней (её освещает лампа).

const GLOW_DEPTH = 12;
const DUST_DEPTH = 6;
const TRAIL_DEPTH = 19; // сразу под призраком
const ADD = Phaser.BlendModes.ADD;

const GHOST_COLORS = [0x66c2fd, 0x9fe0ff, 0x3a8ae0];

export class Effects {
  constructor(scene, floorY) {
    this.scene = scene;
    const { width } = scene.scale;

    // Формы частиц: точка, искра, огонёк и круглый клуб
    makeArt(scene, 'fx-dot', 1, 1, (b) => b.dot(0, 0, 0xffffff));
    makeArt(scene, 'fx-spark', 2, 2, (b) => b.rect(0, 0, 2, 2, 0xffffff));
    makeArt(scene, 'fx-wisp', 3, 3, (b) => b.stamp(0, 0, ['.w.', 'www', '.w.'], { w: 0xffffff }));
    makeArt(scene, 'fx-puff', 7, 7, (b) => {
      b.stamp(0, 0, ['..www..', '.wwwww.', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.wwwww.', '..www..'], { w: 0xffffff });
    });

    // Искры: разлетаются, падают и отскакивают от пола
    this.sparkEmitter = scene.add
      .particles(0, 0, 'fx-spark', {
        emitting: false,
        lifespan: { min: 300, max: 900 },
        speed: { min: 40, max: 190 },
        angle: { min: 0, max: 360 },
        gravityY: 420,
        bounce: 0.45,
        bounds: { x: 0, y: 0, width, height: floorY + 14 },
        color: [0xffffff, 0xfff0a8, 0xffa040, 0xb03a1a], // остывают: белые, жёлтые, рыжие
        scale: { start: 1, end: 0.5 },
        blendMode: ADD,
      })
      .setDepth(GLOW_DEPTH);

    // Дымок: поднимается и тает
    this.smokeEmitter = scene.add
      .particles(0, 0, 'fx-wisp', {
        emitting: false,
        lifespan: { min: 900, max: 1600 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -22, max: -10 },
        scale: { start: 0.6, end: 2 },
        alpha: { start: 0.35, end: 0 },
        tint: 0x8a879a,
      })
      .setDepth(GLOW_DEPTH);

    // Клубы пыли
    this.dustEmitter = scene.add
      .particles(0, 0, 'fx-puff', {
        emitting: false,
        lifespan: { min: 500, max: 1000 },
        speedX: { min: -28, max: 28 },
        speedY: { min: -34, max: -6 },
        scale: { start: 0.4, end: 1.3 },
        alpha: { start: 0.7, end: 0 },
        tint: [0x9a8f84, 0x7a7068],
      })
      .setDepth(DUST_DEPTH);

    // Светящийся след призрака
    this.trailEmitter = scene.add
      .particles(0, 0, 'fx-wisp', {
        emitting: false,
        lifespan: { min: 450, max: 900 },
        speedX: { min: -6, max: 6 },
        speedY: { min: -12, max: 4 },
        scale: { start: 1.7, end: 0.3 },
        alpha: { start: 0.9, end: 0 },
        tint: GHOST_COLORS,
        blendMode: ADD,
      })
      .setDepth(TRAIL_DEPTH);

    // Брызги во все стороны (призрак вылетает из предмета)
    this.burstEmitter = scene.add
      .particles(0, 0, 'fx-wisp', {
        emitting: false,
        lifespan: { min: 300, max: 550 },
        speed: { min: 30, max: 95 },
        angle: { min: 0, max: 360 },
        scale: { start: 1.3, end: 0.2 },
        alpha: { start: 1, end: 0 },
        tint: GHOST_COLORS,
        blendMode: ADD,
      })
      .setDepth(GLOW_DEPTH);
  }

  // Пылинки, парящие в луче света. pickPoint(point) кладёт в point случайное место
  // внутри луча, count — сколько пылинок примерно висит в воздухе
  motes(color, pickPoint, count) {
    return this.scene.add
      .particles(0, 0, 'fx-dot', {
        emitZone: { type: 'random', source: { getRandomPoint: pickPoint } },
        lifespan: { min: 4000, max: 8000 },
        frequency: 6000 / count,
        speedX: { min: -4, max: 4 },
        speedY: { min: -5, max: 2 },
        // Пылинка проявляется и снова тает
        alpha: { onEmit: () => 0, onUpdate: (particle, key, t) => Math.sin(t * Math.PI) * 0.8 },
        tint: color,
        blendMode: ADD,
        advance: 6000, // к началу игры пылинки уже в воздухе
      })
      .setDepth(GLOW_DEPTH);
  }

  sparks(x, y, count = 26) {
    this.sparkEmitter.explode(count, x, y);
  }

  // Дымок идёт из точки полторы секунды
  smoke(x, y) {
    this.scene.time.addEvent({
      delay: 90,
      repeat: 16,
      callback: () => this.smokeEmitter.emitParticleAt(x + Phaser.Math.Between(-1, 1), y),
    });
  }

  // Пыль вдоль отрезка шириной spread в обе стороны от x
  dust(x, y, spread, count) {
    for (let i = 0; i < count; i++) {
      this.dustEmitter.emitParticleAt(x + Phaser.Math.Between(-spread, spread), y);
    }
  }

  trail(x, y) {
    this.trailEmitter.emitParticleAt(x, y);
  }

  // Тающий светящийся отпечаток картинки — остаётся позади при быстром полёте
  afterimage(image, color) {
    const copy = this.scene.add
      .image(image.x, image.y, image.texture.key)
      .setTint(color)
      .setAlpha(0.3)
      .setBlendMode(ADD)
      .setDepth(TRAIL_DEPTH);
    this.scene.tweens.add({ targets: copy, alpha: 0, duration: 260, onComplete: () => copy.destroy() });
  }

  burst(x, y) {
    this.burstEmitter.explode(16, x, y);
  }

  // Вихрь: огоньки по спирали втягиваются в точку (призрак вселяется в предмет)
  swirlIn(x, y) {
    const emitter = this.scene.add
      .particles(x, y, 'fx-wisp', {
        emitting: false,
        emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 30), quantity: 14 },
        moveToX: 0,
        moveToY: 0,
        lifespan: 320,
        scale: { start: 1.4, end: 0.4 },
        alpha: { start: 0.3, end: 1 },
        tint: GHOST_COLORS,
        blendMode: ADD,
      })
      .setDepth(GLOW_DEPTH);
    emitter.explode(14);
    // Огоньки летят к центру, а весь круг поворачивается — получается спираль
    this.scene.tweens.add({ targets: emitter, angle: 220, duration: 340, onComplete: () => emitter.destroy() });
  }
}
