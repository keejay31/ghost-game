import Phaser from 'phaser';
import { Synth } from '../audio/Synth.js';
import { makeArt } from '../fx/pixelArt.js';

// Цвета портрета
const FRAME = 0xa8823a;
const FRAME_LIGHT = 0xe0bc60;
const FRAME_DARK = 0x6a4c1c;
const FRAME_DEEP = 0x3e2c10;
const NAIL = 0xfff2a8;
const CANVAS = 0x33414a;
const CANVAS_DARK = 0x263138;
const CANVAS_LIGHT = 0x40525a;
const HAIR = 0x1c1418;
const SKIN = 0xb9ad98;
const SKIN_DARK = 0x978c7a;
const SKIN_LIGHT = 0xcdc2ae;
const EYE = 0x16101a;
const LIPS = 0x6a4a4a;
const COLLAR = 0xd8d2c4;
const COLLAR_DARK = 0xa8a294;
const DRESS = 0x2c2434;
const DRESS_LIGHT = 0x3c3248;
const BUTTON = 0x8a7a50;
// Лицо, когда внутри призрак (цвета призрака)
const GHOST = 0x66c2fd;
const GHOST_DARK = 0x3a8ae0;
const GHOST_LIGHT = 0x9fe0ff;
const GHOST_EYE = 0x041347;
const EYE_GLOW = 0xe8fdff; // глаза, когда портрет «смотрит»

const W = 60; // рама
const H = 78;
const BORDER = 6; // толщина рамы
const ROPE_H = 12; // верёвка над рамой
// Лицо: середина и размер (от верхнего левого угла рамы)
const FACE = { x: 30, y: 31, rx: 9, ry: 11 };
const EYES_X = [-5, 2]; // левый край каждого глаза (от середины лица)
const POSSESS_MARGIN = 24; // с какого расстояния от рамы можно вселиться
const LOOK_DISTANCE = 120; // как далеко достаёт взгляд (от середины портрета)
const LOOK_TIME = 1.8; // сколько секунд глаза горят и следят
const BOO_TIME = 0.75; // сколько длится «БУ!»

// Волосы закрывают верх лба и виски
const underHair = (dx, dy) => dy < -6 || (Math.abs(dx) >= 7 && dy < 5);

// Лицо. ghost = true — лицо призрака: голубое, с большими тёмными глазами и ртом
function paintFace(b, ghost) {
  const cx = FACE.x;
  const cy = FACE.y + ROPE_H;
  const [skin, dark, light] = ghost ? [GHOST, GHOST_DARK, GHOST_LIGHT] : [SKIN, SKIN_DARK, SKIN_LIGHT];

  for (let dy = -FACE.ry; dy <= FACE.ry; dy++) {
    for (let dx = -FACE.rx; dx <= FACE.rx; dx++) {
      if ((dx / FACE.rx) ** 2 + (dy / FACE.ry) ** 2 > 1 || underHair(dx, dy)) continue;
      let color = skin;
      if (Math.abs(dx) >= 6 || dy > 8 || dy === -6) color = dark; // тени: щёки, подбородок, под волосами
      else if (Math.abs(dx) < 3 && dy < -2) color = light; // блик на лбу
      b.dot(cx + dx, cy + dy, color);
    }
  }

  if (ghost) {
    for (const ex of EYES_X) {
      b.rect(cx + ex, cy - 4, 3, 6, GHOST_EYE);
      b.dot(cx + ex, cy - 4, skin); // скруглённые уголки глаз
      b.dot(cx + ex + 2, cy - 4, skin);
    }
    b.rect(cx - 1, cy + 5, 3, 4, GHOST_EYE);
    return;
  }
  // Брови, пустые глаза с тенями под ними, нос, рот уголками вниз
  for (const ex of EYES_X) {
    b.rect(cx + ex - 1, cy - 4, 4, 1, HAIR);
    b.rect(cx + ex, cy - 2, 3, 2, EYE);
    b.rect(cx + ex, cy, 3, 1, dark);
  }
  b.rect(cx, cy - 1, 1, 5, dark);
  b.rect(cx - 1, cy + 4, 3, 1, dark);
  b.rect(cx - 3, cy + 7, 6, 1, LIPS);
  b.dot(cx - 4, cy + 8, dark);
  b.dot(cx + 3, cy + 8, dark);
}

// Нарисовать портрет: верёвка, рама, холст, человек. И отдельно — лицо призрака
// и его горящие глаза
function paintPortrait(scene) {
  makeArt(scene, 'portrait', W, H + ROPE_H, (b) => {
    const top = ROPE_H;
    const cx = FACE.x;
    const cy = FACE.y + top;

    // Верёвка от гвоздя к углам рамы
    b.line(W / 2, 0, 7, top, FRAME_DARK);
    b.line(W / 2, 0, W - 8, top, FRAME_DARK);

    // Рама: блик сверху-слева, золото, канавка, внутренняя тень
    b.rect(0, top, W, H, FRAME_DEEP);
    b.rect(0, top, W - 1, H - 1, FRAME_LIGHT);
    b.rect(1, top + 1, W - 2, H - 2, FRAME);
    b.rect(3, top + 3, W - 6, H - 6, FRAME_DARK);
    b.rect(4, top + 4, W - 8, H - 8, FRAME_LIGHT);
    b.rect(5, top + 5, W - 10, H - 10, FRAME_DEEP);
    // Украшения по углам и табличка внизу
    for (const [ox, oy] of [[1, 1], [W - 5, 1], [1, H - 5], [W - 5, H - 5]]) {
      b.rect(ox, top + oy, 4, 4, FRAME_LIGHT);
      b.rect(ox + 1, top + oy + 1, 2, 2, FRAME_DARK);
    }
    b.rect(W / 2 - 7, top + H - 5, 14, 3, FRAME_LIGHT);
    b.rect(W / 2 - 5, top + H - 4, 10, 1, FRAME_DARK);

    // Холст: вокруг головы светлее, по углам темнее, на границах — «шахматка»
    const left = BORDER;
    const right = W - BORDER;
    const bottom = top + H - BORDER;
    for (let y = top + BORDER; y < bottom; y++) {
      for (let x = left; x < right; x++) {
        const d = Math.hypot(x - cx, (y - cy) * 0.8) + ((x + y) % 2) * 3;
        b.dot(x, y, d < 18 ? CANVAS_LIGHT : d > 30 ? CANVAS_DARK : CANVAS);
      }
    }

    // Волосы
    for (let dy = -FACE.ry - 2; dy <= 6; dy++) {
      for (let dx = -FACE.rx - 2; dx <= FACE.rx + 2; dx++) {
        if ((dx / (FACE.rx + 2)) ** 2 + ((dy + 1) / (FACE.ry + 2)) ** 2 <= 1) b.dot(cx + dx, cy + dy, HAIR);
      }
    }

    // Шея, платье с плечами и складками
    b.rect(cx - 3, cy + 9, 7, 7, SKIN_DARK);
    for (let y = cy + 14; y < bottom; y++) {
      const half = Math.min(right - cx, Math.round(9 + (y - cy - 14) * 2.2));
      b.rect(cx - half, y, half * 2, 1, DRESS);
    }
    for (const fx of [-14, -8, 9, 15]) b.rect(cx + fx, cy + 26, 1, bottom - cy - 26, DRESS_LIGHT);

    // Кружевной воротник и пуговицы
    [5, 7, 8, 8, 7, 5].forEach((half, i) => b.rect(cx - half, cy + 13 + i, half * 2 + 1, 1, i > 3 ? COLLAR_DARK : COLLAR));
    for (let x = -8; x <= 8; x += 2) b.dot(cx + x, cy + 16, COLLAR_DARK);
    for (const by of [23, 29, 35]) b.rect(cx, cy + by, 2, 2, BUTTON);

    paintFace(b, false);

    // Блик на лаке
    b.line(left + 2, top + 30, left + 20, top + BORDER + 2, 0xffffff, 0.06);
    b.line(left + 6, top + 30, left + 24, top + BORDER + 2, 0xffffff, 0.04);
  });

  makeArt(scene, 'portrait-ghost', W, H + ROPE_H, (b) => paintFace(b, true));
  makeArt(scene, 'portrait-eyes', W, H + ROPE_H, (b) => {
    for (const ex of EYES_X) {
      b.rect(FACE.x + ex, FACE.y + ROPE_H - 3, 3, 5, EYE_GLOW);
      b.dot(FACE.x + ex + 1, FACE.y + ROPE_H - 4, EYE_GLOW);
    }
  });
}

// Портрет на стене. x — середина, y — гвоздь, на котором он висит
export class Portrait {
  constructor(scene, x, y) {
    this.scene = scene;
    this.synth = new Synth(scene);
    this.events = new Phaser.Events.EventEmitter();
    this.label = 'портрет'; // для подсказки «вселиться в …»
    this.isPossessed = false;
    this.time = 0;
    this.lookLeft = 0; // сколько ещё горят глаза
    this.booLeft = 0; // сколько ещё длится «БУ!»
    this.kick = 0; // насколько сильно портрет трясётся

    // Куда ныряет призрак — в лицо
    this.x = x;
    this.y = y + ROPE_H + FACE.y;
    this.top = y + ROPE_H; // верх и низ рамы
    this.bottom = this.top + H;

    paintPortrait(scene);
    const shadow = scene.add.image(3, 4, 'portrait').setOrigin(0.5, 0).setTintFill(0x000000).setAlpha(0.3);
    const picture = scene.add.image(0, 0, 'portrait').setOrigin(0.5, 0);
    // Лицо призрака поверх нарисованного — видно, только когда он внутри
    this.ghostFace = scene.add.image(0, 0, 'portrait-ghost').setOrigin(0.5, 0).setVisible(false);
    // Горящие глаза со зрачками — когда портрет следит за людьми
    this.eyes = scene.add.image(0, 0, 'portrait-eyes').setOrigin(0.5, 0).setVisible(false);
    this.pupils = EYES_X.map(() => scene.add.rectangle(0, 0, 1, 2, GHOST_EYE).setOrigin(0).setVisible(false));
    this.eyeLight = scene.lighting.addLight('light-soft', GHOST_LIGHT).setPosition(this.x, this.y).setAlpha(0);
    this.eyeGlow = scene.lighting
      .addGlow('light-soft', GHOST_LIGHT)
      .setPosition(this.x, this.y - 1)
      .setDisplaySize(30, 18)
      .setAlpha(0);

    // Всё вместе качается на гвозде
    this.view = scene.add.container(x, y, [shadow, picture, this.ghostFace, this.eyes, ...this.pupils]);
    scene.add.rectangle(x, y, 2, 2, NAIL);
  }

  // Призрак рядом — перед портретом или вплотную к раме
  isNear(x, y) {
    return (
      Math.abs(x - this.x) < W / 2 + POSSESS_MARGIN &&
      y > this.top - POSSESS_MARGIN &&
      y < this.bottom + POSSESS_MARGIN
    );
  }

  // Куда вылетает призрак — сбоку от рамы
  get exitPoint() {
    return { x: this.x + W / 2 + 16, y: this.y };
  }

  // Достаёт ли взгляд портрета до точки x
  sees(x) {
    return Math.abs(x - this.x) <= LOOK_DISTANCE;
  }

  setPossessed(value) {
    this.isPossessed = value;
    this.ghostFace.setVisible(value);
    this.lookLeft = 0;
    this.booLeft = 0;
  }

  actionsHint() {
    return 'Пробел — глаза следят    Q — «БУ!»    E — выйти';
  }

  smallAction() {
    this.look();
  }

  bigAction() {
    this.boo();
  }

  // Глаза загораются и следят за ближайшим человеком
  look() {
    if (this.lookLeft > 0 || this.booLeft > 0) return;
    this.lookLeft = LOOK_TIME;
    this.synth.stare();
    this.events.emit('look');
  }

  // Призрак высовывается из картины с криком «БУ!» (самого призрака показывает сцена)
  boo() {
    if (this.booLeft > 0) return;
    this.booLeft = BOO_TIME;
    this.lookLeft = 0;
    this.kick = 0.14;
    this.ghostFace.setVisible(false); // призрак вылез — на картине опять человек

    this.synth.boo();
    this.scene.cameras.main.shake(220, 0.01);
    this.scene.fx.burst(this.x, this.y);
    this.events.emit('boo');

    const text = this.scene.add
      .text(this.x, this.top - 2, 'БУ!', { fontFamily: 'monospace', fontSize: '18px', color: '#9ff0ff' })
      .setOrigin(0.5, 1)
      .setDepth(21);
    this.scene.tweens.add({
      targets: text,
      y: text.y - 16,
      alpha: 0,
      delay: 400,
      duration: 600,
      onComplete: () => text.destroy(),
    });
  }

  // Ближайший человек в комнате (или undefined, если все убежали)
  nearestPerson() {
    const here = this.scene.people.filter((p) => p.state !== 'gone');
    return here.sort((a, b) => Math.abs(a.x - this.x) - Math.abs(b.x - this.x))[0];
  }

  update(dt) {
    this.time += dt;

    // «БУ!» закончилось — призрак снова в картине
    if (this.booLeft > 0) {
      this.booLeft -= dt;
      if (this.booLeft <= 0) this.ghostFace.setVisible(this.isPossessed);
    }

    // С призраком внутри портрет покачивается, после «БУ!» — трясётся
    this.kick *= Math.exp(-dt * 6);
    const sway = this.isPossessed ? Math.sin(this.time * 2.2) * 0.035 : 0;
    const target = sway + Math.sin(this.time * 45) * this.kick;
    this.view.rotation += (target - this.view.rotation) * Math.min(1, dt * 20);

    // Горящие глаза: зрачки повёрнуты к ближайшему человеку
    this.lookLeft -= dt;
    const looking = this.lookLeft > 0;
    this.eyes.setVisible(looking);
    this.pupils.forEach((pupil) => pupil.setVisible(looking));
    const glow = Phaser.Math.Clamp(this.lookLeft / 0.3, 0, 1) * (0.85 + 0.15 * Math.sin(this.time * 20));
    this.eyeLight.setAlpha(glow * 0.8);
    this.eyeGlow.setAlpha(glow * 0.3);
    if (!looking) return;

    const person = this.nearestPerson();
    const dx = person ? person.x - this.x : 0;
    const lookX = Math.abs(dx) < 14 ? 0 : Math.sign(dx);
    const lookY = !person ? 0 : Math.abs(dx) < 160 ? 2 : 1; // люди внизу — чем ближе, тем ниже взгляд
    this.pupils.forEach((pupil, i) => pupil.setPosition(EYES_X[i] + 1 + lookX, ROPE_H + FACE.y - 2 + lookY));
  }
}
