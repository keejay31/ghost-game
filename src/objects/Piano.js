import Phaser from 'phaser';
import { Synth } from '../audio/Synth.js';
import { makeArt } from '../fx/pixelArt.js';

// Цвета пианино
const WOOD = 0x5a3826;
const WOOD_LIGHT = 0x7a4e32;
const WOOD_SHINE = 0x9c6c46; // блик на кромках
const WOOD_DARK = 0x40261a;
const WOOD_DEEP = 0x24140f; // самая глубокая тень
const PANEL_POSSESSED = 0x66c2fd; // панель, когда внутри призрак (цвет призрака)
const KEY_WHITE = 0xd8d0c0;
const KEY_SHADE = 0xb4ab9a;
const KEY_GAP = 0x9a9080;
const KEY_BLACK = 0x111014;
const KEY_PRESSED = 0xfff2b0;
const PEDAL = 0xd9ae38;
const PEDAL_LIGHT = 0xfff2a8;
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

// Нарисовать пианино. Верхняя панель — отдельной серой картинкой: её красит цвет
// дерева, а когда внутри призрак — цвет призрака
function paintPiano(scene) {
  const rnd = new Phaser.Math.RandomDataGenerator(['piano']);

  makeArt(scene, 'piano', W + 4, H, (b) => {
    // Координаты как у самого пианино: x — от левого края, y — от пола вверх (с минусом)
    const r = (x, y, w, h, color, alpha) => b.rect(x + 2, y + H, w, h, color, alpha);

    // Крышка сверху
    r(-2, -H, W + 4, 4, WOOD_LIGHT);
    r(-2, -H, W + 4, 1, WOOD_SHINE);
    r(-2, -H + 3, W + 4, 1, WOOD_DARK);

    // Полка с клавишами
    r(0, -38, W, 12, WOOD);
    r(0, -27, W, 1, WOOD_SHINE);
    r(0, -38, 2, 12, WOOD_LIGHT);
    r(W - 2, -38, 2, 12, WOOD_LIGHT);

    // Клавиши: белые, щели между ними, чёрные (по 2 и по 3, как на настоящем)
    r(2, KEYS_Y, W - 4, 7, KEY_WHITE);
    r(2, KEYS_Y + 6, W - 4, 1, KEY_SHADE);
    const hasBlack = [1, 1, 0, 1, 1, 1, 0];
    for (let i = 1; i < WHITE_KEYS; i++) {
      const kx = 2 + i * KEY_W;
      r(kx - 1, KEYS_Y, 1, 7, KEY_GAP);
      if (hasBlack[(i - 1) % 7]) r(kx - 1, KEYS_Y, 2, 4, KEY_BLACK);
    }

    // Низ: корпус и углублённая панель
    r(0, -26, W, 26, WOOD);
    r(8, -22, W - 16, 17, WOOD_LIGHT);
    r(8, -22, W - 17, 16, WOOD_DEEP);
    r(9, -21, W - 18, 15, WOOD_DARK);
    for (let i = 0; i < 12; i++) r(rnd.between(10, W - 26), rnd.between(-20, -8), rnd.between(6, 14), 1, 0x000000, 0.12);
    r(0, -26, W, 2, WOOD_DEEP); // тень под полкой

    // Ножки по бокам
    for (const x of [0, W - 6]) {
      r(x, -24, 6, 24, WOOD_LIGHT);
      r(x, -24, 1, 24, WOOD_SHINE);
      r(x + 5, -24, 1, 24, WOOD_DARK);
      r(x - 1, -3, 8, 3, WOOD_LIGHT);
    }

    // Педали
    r(W / 2 - 12, -6, 24, 6, WOOD_DEEP);
    for (const x of [-9, -2, 5]) {
      r(W / 2 + x, -4, 4, 2, PEDAL);
      r(W / 2 + x, -4, 2, 1, PEDAL_LIGHT);
    }
  });

  makeArt(scene, 'piano-panel', W, 30, (b) => {
    b.rect(0, 0, W, 30, 0xbbbbbb);
    b.rect(0, 0, 1, 30, 0xeeeeee);
    b.rect(W - 1, 0, 1, 30, 0x888888);
    // Углублённая филёнка: тень сверху-слева, блик снизу-справа
    b.rect(6, 4, W - 12, 20, 0xffffff);
    b.rect(6, 4, W - 13, 19, 0x707070);
    b.rect(7, 5, W - 14, 18, 0xa4a4a4);
    for (let i = 0; i < 10; i++) b.rect(rnd.between(9, W - 24), rnd.between(6, 21), rnd.between(6, 14), 1, 0x000000, 0.1);
    // Полочка для нот
    b.rect(16, 25, W - 32, 2, 0xf4f4f4);
    b.rect(16, 27, W - 32, 1, 0x666666);
  });
}

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

    // Тень на полу под пианино
    scene.add
      .image(this.x, floorY + 2, 'light-soft')
      .setTint(0x000000)
      .setDisplaySize(W + 36, 16)
      .setAlpha(0.6);

    paintPiano(scene);
    const body = scene.add.image(-2, -H, 'piano').setOrigin(0);
    this.panel = scene.add.image(0, -H + 4, 'piano-panel').setOrigin(0).setTint(WOOD_LIGHT); // верхняя панель

    const add = (rx, ry, w, h, color) => scene.add.rectangle(rx, ry, w, h, color).setOrigin(0);
    this.keyGlow = add(0, KEYS_Y, KEY_W - 1, 7, KEY_PRESSED).setVisible(false);

    // Откинутая крышка над клавишами — она и захлопывается
    this.lid = add(2, -38, W - 4, 5, WOOD_LIGHT);

    // Глаза призрака на верхней панели
    this.eyes = [add(W / 2 - 9, -60, 4, 6, 0x041347), add(W / 2 + 5, -60, 4, 6, 0x041347)];
    this.eyes.forEach((e) => e.setVisible(false));

    this.view = scene.add.container(x, floorY, [body, this.panel, this.keyGlow, this.lid, ...this.eyes]);
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
    this.panel.setTint(value ? PANEL_POSSESSED : WOOD_LIGHT);
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
