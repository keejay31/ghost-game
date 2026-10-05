import Phaser from 'phaser';
import { Synth } from '../audio/Synth.js';

// Цвета пианино (заглушки)
const WOOD = 0x5a3826;
const WOOD_LIGHT = 0x7a4e32;
const WOOD_DARK = 0x40261a;
const PANEL_POSSESSED = 0x66c2fd; // панель, когда внутри призрак (цвет призрака)
const KEY_WHITE = 0xd8d0c0;
const KEY_GAP = 0x9a9080;
const KEY_BLACK = 0x111014;
const KEY_PRESSED = 0xfff2b0;
const PEDAL = 0xc9a227;
const DUST = 0x8a7f74;

const W = 92; // ширина
const H = 72; // высота
const KEYS_Y = -33; // верх клавиш (от пола)
const KEY_W = 4; // ширина белой клавиши
const WHITE_KEYS = (W - 4) / KEY_W;
const HEAR_DISTANCE = 160; // на сколько слышно игру (от середины пианино)
const STEP = 0.36; // секунд между нотами

// Жуткая мелодия: [частота в Гц, номер доли]
const MELODY = [
  [110, 0],
  [220, 0],
  [261.63, 1],
  [329.63, 2],
  [311.13, 3],
  [87.31, 4],
  [246.94, 4],
  [349.23, 5],
  [329.63, 6],
  [110, 7.5],
  [220, 7.5],
];

// Пианино у стены. x — левый край, floorY — пол
export class Piano {
  constructor(scene, x, floorY) {
    this.scene = scene;
    this.synth = new Synth(scene);
    this.events = new Phaser.Events.EventEmitter();
    this.label = 'пианино'; // для подсказки «вселиться в …»
    this.left = x;
    this.floorY = floorY;
    this.isPlaying = false;
    this.isClosed = false; // крышка захлопнута
    this.isPossessed = false;
    this.timers = [];
    this.glowLeft = 0; // сколько ещё горит нажатая клавиша
    this.bumpLeft = 0; // сколько ещё пианино «подпрыгнуло»

    // Куда ныряет призрак — середина верхней панели
    this.x = x + W / 2;
    this.y = floorY - 56;

    const parts = [];
    const add = (rx, ry, w, h, color) => {
      const r = scene.add.rectangle(rx, ry, w, h, color).setOrigin(0);
      parts.push(r);
      return r;
    };

    add(-2, -H, W + 4, 4, WOOD_LIGHT); // крышка сверху
    this.panel = add(0, -H + 4, W, 30, WOOD); // верхняя панель
    add(0, -38, W, 12, WOOD); // корпус вокруг клавиш

    // Клавиши: белые, щели между ними, чёрные (по 2 и по 3, как на настоящем)
    add(2, KEYS_Y, W - 4, 7, KEY_WHITE);
    const hasBlack = [1, 1, 0, 1, 1, 1, 0];
    for (let i = 1; i < WHITE_KEYS; i++) {
      const kx = 2 + i * KEY_W;
      add(kx - 1, KEYS_Y, 1, 7, KEY_GAP);
      if (hasBlack[(i - 1) % 7]) add(kx - 1, KEYS_Y, 2, 4, KEY_BLACK);
    }
    this.keyGlow = add(0, KEYS_Y, KEY_W - 1, 7, KEY_PRESSED).setVisible(false);

    // Откинутая крышка над клавишами — она и захлопывается
    this.lid = add(2, -38, W - 4, 5, WOOD_LIGHT);

    // Низ и педали
    add(0, -26, W, 26, WOOD);
    add(8, -23, W - 16, 17, WOOD_DARK);
    add(W / 2 - 9, -4, 4, 2, PEDAL);
    add(W / 2 - 2, -4, 4, 2, PEDAL);
    add(W / 2 + 5, -4, 4, 2, PEDAL);

    // Глаза призрака на верхней панели
    this.eyes = [add(W / 2 - 9, -60, 4, 6, 0x041347), add(W / 2 + 5, -60, 4, 6, 0x041347)];
    this.eyes.forEach((e) => e.setVisible(false));

    this.view = scene.add.container(x, floorY, parts);
  }

  // Призрак рядом — над пианино или вплотную к нему
  isNear(x, y) {
    return x > this.left - 12 && x < this.left + W + 12 && y > this.floorY - H - 16;
  }

  // Куда вылетает призрак
  get exitPoint() {
    return { x: this.x, y: this.floorY - H - 22 };
  }

  // Слышно ли игру в точке x
  canHear(x) {
    return Math.abs(x - this.x) <= HEAR_DISTANCE;
  }

  setPossessed(value) {
    this.isPossessed = value;
    this.panel.fillColor = value ? PANEL_POSSESSED : WOOD;
    this.eyes.forEach((e) => e.setVisible(value));
  }

  actionsHint() {
    return this.isClosed ? 'E — выйти' : 'Пробел — играть    Q — захлопнуть крышку    E — выйти';
  }

  smallAction() {
    this.play();
  }

  bigAction() {
    this.slam();
  }

  // Сыграть жуткую мелодию
  play() {
    if (this.isClosed || this.isPlaying) return;
    this.isPlaying = true;
    this.bus = this.synth.bus();
    for (const [freq, beat] of MELODY) {
      const delay = beat * STEP;
      this.synth.note(freq, delay, 1.6, 0.18, this.bus);
      this.timers.push(this.scene.time.delayedCall(delay * 1000, () => this.showNote(freq)));
    }
    const end = (MELODY[MELODY.length - 1][1] * STEP + 0.6) * 1000;
    this.timers.push(
      this.scene.time.delayedCall(end, () => {
        this.isPlaying = false;
      }),
    );
    this.events.emit('play');
  }

  // Нажатая клавиша светится, пианино подпрыгивает, вылетает «♪»
  showNote(freq) {
    const idx = Phaser.Math.Clamp(Math.round(Math.log2(freq / 110) * 7) + 3, 0, WHITE_KEYS - 1);
    this.keyGlow.setPosition(2 + idx * KEY_W, KEYS_Y).setVisible(true);
    this.glowLeft = 0.15;
    this.bumpLeft = 0.08;

    const note = this.scene.add
      .text(this.x + Phaser.Math.Between(-30, 30), this.floorY - H - 2, '♪', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#9ff0ff',
      })
      .setOrigin(0.5, 1)
      .setDepth(15);
    this.scene.tweens.add({
      targets: note,
      y: note.y - 26,
      alpha: 0,
      duration: 1200,
      onComplete: () => note.destroy(),
    });
  }

  // Захлопнуть крышку — навсегда
  slam() {
    if (this.isClosed) return;
    this.isClosed = true;
    this.isPlaying = false;

    // Музыка обрывается
    this.synth.mute(this.bus);
    this.timers.forEach((t) => t.remove());
    this.timers = [];
    this.keyGlow.setVisible(false);

    // Крышка падает на клавиши
    this.scene.tweens.add({
      targets: this.lid,
      y: -34,
      scaleY: 1.6,
      duration: 70,
      ease: 'Quad.easeIn',
      onComplete: () => this.bang(),
    });
  }

  bang() {
    this.synth.bang();
    this.scene.cameras.main.shake(250, 0.012);
    this.events.emit('slam');

    // «БАБАХ!»
    const text = this.scene.add
      .text(this.x, this.floorY - H - 4, 'БАБАХ!', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffe066',
      })
      .setOrigin(0.5, 1)
      .setDepth(15);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 16,
      alpha: 0,
      delay: 400,
      duration: 700,
      onComplete: () => text.destroy(),
    });

    // Пыль из-под крышки
    for (let i = 0; i < 10; i++) {
      const dust = this.scene.add
        .rectangle(this.left + Phaser.Math.Between(4, W - 4), this.floorY - 34, 2, 2, DUST)
        .setDepth(6);
      this.scene.tweens.add({
        targets: dust,
        x: dust.x + Phaser.Math.Between(-10, 10),
        y: dust.y - Phaser.Math.Between(8, 20),
        alpha: 0,
        duration: Phaser.Math.Between(500, 800),
        onComplete: () => dust.destroy(),
      });
    }
  }

  update(dt) {
    this.glowLeft -= dt;
    if (this.glowLeft <= 0) this.keyGlow.setVisible(false);
    this.bumpLeft -= dt;
    this.view.y = this.bumpLeft > 0 ? this.floorY - 1 : this.floorY;
  }
}
