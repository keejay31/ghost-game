import Phaser from 'phaser';
import { Synth } from '../audio/Synth.js';
import { makeLightTexture, mixColor } from '../fx/Lighting.js';
import { makeArt } from '../fx/pixelArt.js';

// Цвета лампы
const ROSE = 0x6e5a80; // лепная розетка на потолке — как карниз комнаты
const ROSE_LIGHT = 0x8c76a2;
const ROSE_DARK = 0x433456;
const BRASS = 0xd9ae38; // цепь, колпачок, тесьма и бахрома
const BRASS_LIGHT = 0xfff2a8;
const BRASS_DARK = 0x8f6a1e;
const SHADE = 0xa04a5c; // бордовая ткань
const SHADE_LIT = 0xffb890; // абажур просвечивает, когда лампа горит
const SHADE_POSSESSED = 0x66c2fd; // абажур, когда внутри призрак (цвет призрака)
const BULB_ON = 0xfff2b0;
const BULB_OFF = 0x9a917c;
const BULB_BROKEN = 0x6b6455;
const LIGHT = 0xffe0a8; // тёплый свет лампы
const GLASS = 0xe8f4ff;

const CHAIN_LEN = 26;
const SHADE_W = 42;
const SHADE_H = 24;
const SHADE_TOP_W = 14; // абажур сужается кверху
const RIBS = 6; // на сколько клиньев абажур разделён каркасом
const FRINGE = 6; // длина бахромы
const LIGHT_HALF_WIDTH = 120; // полуширина луча у пола
const POSSESS_DISTANCE = 44; // с какого расстояния можно вселиться

// Рисунок света лампы: конус от абажура до пола с мягкими краями и пятно на полу.
// Верх картинки — потолок, середина по ширине — цепь
function makeConeTexture(scene, toFloor, height) {
  const w = (LIGHT_HALF_WIDTH + 40) * 2;
  const top = CHAIN_LEN + SHADE_H; // низ абажура
  const smooth = Phaser.Math.SmoothStep;
  makeLightTexture(scene, 'lamp-cone', w, height, (px, py) => {
    const x = Math.abs(px - w / 2);
    if (py < top) return 0;
    if (py > toFloor) {
      // Пятно на полу — овал
      const depth = (py - toFloor) / (height - toFloor); // 0 — у стены, 1 — низ экрана
      const d = Math.hypot(x / (LIGHT_HALF_WIDTH + 6), (depth - 0.35) / 1.1);
      return (1 - smooth(d, 0.5, 1.05)) * 0.8;
    }
    const t = (py - top) / (toFloor - top); // 0 — у абажура, 1 — у пола
    const half = SHADE_W / 2 + (LIGHT_HALF_WIDTH - SHADE_W / 2) * t; // полуширина луча на этой высоте
    const fade = 1 / (1 + 1.2 * t * t); // чем дальше от лампы, тем слабее
    return (1 - smooth(x / half, 0.55, 1.05)) * fade;
  });
}

// Полуширина абажура в ряду row: колокол — кверху узкий, книзу расходится
function shadeHalf(row) {
  const t = row / (SHADE_H - 1);
  return Math.round(SHADE_TOP_W / 2 + ((SHADE_W - SHADE_TOP_W) / 2) * (0.35 * t + 0.65 * t * t));
}

// Нарисовать лампу: абажур, латунные детали и лампочку. Абажур и лампочка серые:
// цвет им даёт игра (горит, не горит, внутри призрак)
function paintLamp(scene) {
  const gray = (v) => {
    const g = Phaser.Math.Clamp(Math.round(v / 24) * 24, 0, 255); // несколько ступеней яркости
    return (g << 16) | (g << 8) | g;
  };
  const cx = SHADE_W / 2;

  makeArt(scene, 'lamp-shade', SHADE_W, SHADE_H, (b) => {
    for (let row = 0; row < SHADE_H; row++) {
      const half = shadeHalf(row);
      for (let i = 0; i < half * 2; i++) {
        const u = (i + 0.5) / (half * 2); // 0 — левый край, 1 — правый
        const rib = Math.round(u * half * 2) % Math.round((half * 2) / RIBS) === 0; // рёбра каркаса
        const side = Math.abs(u - 0.38); // блик чуть левее середины
        b.dot(cx - half + i, row, gray(255 - side * 230 - (rib ? 44 : 0) - (row < 2 ? 40 : 0)));
      }
    }
  });

  makeArt(scene, 'lamp-metal', SHADE_W, CHAIN_LEN + SHADE_H + FRINGE, (b) => {
    // Цепь: звенья по очереди — плашмя и ребром
    for (let y = 4; y < CHAIN_LEN - 6; y += 6) {
      b.rect(cx - 1, y, 2, 1, BRASS);
      b.rect(cx - 2, y + 1, 1, 3, BRASS);
      b.rect(cx + 1, y + 1, 1, 3, BRASS_DARK);
      b.rect(cx - 1, y + 4, 2, 1, BRASS_DARK);
      b.rect(cx - 1, y + 3, 2, 4, BRASS_DARK);
      b.rect(cx - 1, y + 3, 1, 4, BRASS);
    }

    // Колпачок над абажуром
    [4, 8, 10, 12, SHADE_TOP_W, SHADE_TOP_W].forEach((w, i) => {
      const y = CHAIN_LEN - 5 + i;
      b.rect(cx - w / 2, y, w, 1, i === 5 ? BRASS_DARK : BRASS);
      if (i < 5) b.rect(cx - w / 2 + 1, y, 2, 1, BRASS_LIGHT);
    });

    // Тесьма по нижнему краю
    const bottom = CHAIN_LEN + SHADE_H;
    b.rect(0, bottom - 3, SHADE_W, 2, BRASS);
    b.rect(0, bottom - 1, SHADE_W, 1, BRASS_DARK);
    for (let x = 1; x < SHADE_W; x += 3) b.dot(x, bottom - 3, BRASS_LIGHT);

    // Бахрома: нити разной длины с бусинами на концах
    for (let x = 0; x < SHADE_W; x += 2) {
      const len = FRINGE - 2 + ((x / 2) % 3);
      b.rect(x, bottom, 1, len, (x / 2) % 2 ? BRASS_DARK : BRASS);
      b.dot(x, bottom + len - 1, BRASS_LIGHT);
    }
  });

  makeArt(scene, 'lamp-bulb', 8, 9, (b) => {
    const rows = ['..wwww..', '.wWWwww.', 'wWWwwwww', 'wWwwwwww', 'wwwwwwww', 'wwwwwwww', '.wwwwww.', '..wwww..', '...ww...'];
    b.stamp(0, 0, rows, { w: 0xdddddd, W: 0xffffff });
  });
  makeArt(scene, 'lamp-bulb-broken', 8, 9, (b) => {
    b.stamp(0, 0, ['..wwww..', '.ww.www.', 'w..w..ww', '...w...w'], { w: 0xffffff });
  });
}

// Лампа под потолком: абажур с бахромой на цепи
export class Lamp {
  constructor(scene, x, ceilingY, floorY) {
    this.scene = scene;
    this.synth = new Synth(scene);
    this.label = 'лампу'; // для подсказки «вселиться в …»
    this.floorY = floorY;
    this.isOn = true;
    this.isBroken = false;
    this.isPossessed = false;
    this.time = 0;
    this.power = 1; // яркость прямо сейчас: 1 — горит, 0 — погасла

    // Сюда подписываются те, кому важен свет (потом — люди)
    this.events = new Phaser.Events.EventEmitter();

    // Центр абажура — к нему подлетает призрак
    this.x = x;
    this.y = ceilingY + CHAIN_LEN + SHADE_H / 2;

    // Свет: конус до пола и ореол вокруг лампочки освещают комнату...
    const lighting = scene.lighting;
    const shadeBottom = CHAIN_LEN + SHADE_H;
    makeConeTexture(scene, floorY - ceilingY, scene.scale.height - ceilingY);
    this.cone = lighting.addLight('lamp-cone', LIGHT).setOrigin(0.5, 0);
    this.halo = lighting.addLight('light-soft', LIGHT).setScale(1.5);
    this.fill = lighting.addLight('light-soft', LIGHT).setScale(5); // слабый свет на всю комнату
    // ...а поверх темноты — луч в воздухе и сияние самой лампочки
    this.beam = lighting.addGlow('lamp-cone', LIGHT).setOrigin(0.5, 0);
    this.shine = lighting.addGlow('light-soft', LIGHT).setScale(0.6);
    // Вспышка на всю комнату, когда лампочка лопается
    this.flash = lighting.addLight('light-soft', 0xfff4d0).setScale(8).setAlpha(0);
    this.flickerLeft = 0; // сколько ещё лампочка моргает после включения

    // Пылинки в луче: у пола луч шире — там их больше
    this.motes = scene.fx.motes(
      LIGHT,
      (point) => {
        const t = Math.sqrt(Math.random()); // 0 — у абажура, 1 — у пола
        const half = SHADE_W / 2 + (LIGHT_HALF_WIDTH - SHADE_W / 2) * t;
        point.x = x + Phaser.Math.FloatBetween(-half, half) * 0.85;
        point.y = ceilingY + shadeBottom + (floorY - ceilingY - shadeBottom) * t;
      },
      40,
    );

    // Лепная розетка на потолке (не качается)
    scene.add.rectangle(x, ceilingY, 26, 2, ROSE_LIGHT).setOrigin(0.5, 0);
    scene.add.rectangle(x, ceilingY + 2, 18, 2, ROSE).setOrigin(0.5, 0);
    scene.add.rectangle(x, ceilingY + 4, 8, 2, ROSE_DARK).setOrigin(0.5, 0);

    paintLamp(scene);
    this.bulb = scene.add.image(0, shadeBottom + 3, 'lamp-bulb').setTint(BULB_ON);
    this.shade = scene.add.image(0, CHAIN_LEN, 'lamp-shade').setOrigin(0.5, 0);
    const metal = scene.add.image(0, 0, 'lamp-metal').setOrigin(0.5, 0);

    // Глаза призрака на абажуре — видны, только когда он внутри
    const eyeY = CHAIN_LEN + 13;
    this.eyes = [
      scene.add.rectangle(-7, eyeY, 4, 6, 0x041347),
      scene.add.rectangle(7, eyeY, 4, 6, 0x041347),
    ];
    this.eyes.forEach((e) => e.setVisible(false));

    // Всё вместе качается вокруг точки на потолке
    this.view = scene.add.container(x, ceilingY, [this.bulb, this.shade, metal, ...this.eyes]);
  }

  isNear(x, y) {
    return Phaser.Math.Distance.Between(x, y, this.x, this.y) < POSSESS_DISTANCE;
  }

  // Куда вылетает призрак — под лампу
  get exitPoint() {
    return { x: this.x, y: this.y + SHADE_H / 2 + 24 };
  }

  actionsHint() {
    return this.isBroken ? 'E — выйти' : 'Пробел — свет    Q — лопнуть    E — выйти';
  }

  smallAction() {
    this.toggle();
  }

  bigAction() {
    this.pop();
  }

  // Стоит ли точка x на полу в луче лампы
  lightsUp(x) {
    return Math.abs(x - this.x) <= LIGHT_HALF_WIDTH;
  }

  setPossessed(value) {
    this.isPossessed = value;
    this.eyes.forEach((e) => e.setVisible(value));
  }

  // Свет вкл/выкл
  toggle() {
    if (this.isBroken) return;
    this.isOn = !this.isOn;
    if (this.isOn) this.flickerLeft = 0.2;
    this.synth.click(this.isOn);
    this.applyLight();
  }

  // Лопнуть лампочку — навсегда
  pop() {
    if (this.isBroken) return;
    this.isBroken = true;
    this.isOn = false;
    // Сначала «лопнула» (пугает сильнее), потом «свет погас»
    this.events.emit('pop');
    this.applyLight();

    this.synth.shatter();
    const cam = this.scene.cameras.main;
    cam.flash(100, 255, 245, 210);
    cam.shake(150, 0.005);
    this.spawnShards();

    // Вспышка, искры и дымок из разбитой лампочки
    const m = this.bulb.getWorldTransformMatrix();
    this.flash.setPosition(m.tx, m.ty).setAlpha(1);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 350, ease: 'Quad.easeOut' });
    this.scene.fx.sparks(m.tx, m.ty);
    this.scene.fx.smoke(m.tx, m.ty);
  }

  applyLight() {
    if (this.isBroken) this.bulb.setTexture('lamp-bulb-broken').setTint(BULB_BROKEN);
    else this.bulb.setTint(this.isOn ? BULB_ON : BULB_OFF);
    this.events.emit('light', this.isOn);
  }

  // Осколки стекла разлетаются и падают на пол
  spawnShards() {
    const m = this.bulb.getWorldTransformMatrix();
    for (let i = 0; i < 8; i++) {
      const shard = this.scene.add.rectangle(m.tx, m.ty, 2, 2, GLASS).setDepth(15);
      this.scene.tweens.add({
        targets: shard,
        x: { value: m.tx + Phaser.Math.Between(-60, 60), ease: 'Sine.easeOut' },
        y: { value: this.floorY + Phaser.Math.Between(0, 6), ease: 'Quad.easeIn' },
        duration: Phaser.Math.Between(400, 650),
        onComplete: () => {
          if (i % 2 === 0) this.synth.tink(); // осколок звякнул об пол
          this.scene.tweens.add({
            targets: shard,
            alpha: 0,
            delay: 1500,
            duration: 500,
            onComplete: () => shard.destroy(),
          });
        },
      });
    }
  }

  update(dt) {
    this.time += dt;
    // С призраком внутри лампа покачивается, без него — успокаивается
    const target = this.isPossessed ? Math.sin(this.time * 2.5) * 0.06 : 0;
    this.view.rotation += (target - this.view.rotation) * Math.min(1, dt * 8);

    // Свет загорается и гаснет за долю секунды
    const goal = this.isOn ? 1 : 0;
    this.power += (goal - this.power) * Math.min(1, dt * 30);
    if (Math.abs(goal - this.power) < 0.01) this.power = goal;
    // Лампочка чуть мерцает, а сразу после включения — моргает
    let p = this.power * (0.97 + 0.03 * Math.sin(this.time * 37) * Math.sin(this.time * 23));
    this.flickerLeft -= dt;
    if (this.flickerLeft > 0) p *= Phaser.Math.FloatBetween(0.35, 1);
    this.motes.setAlpha(p);

    // Абажур: с призраком внутри — цвета призрака, иначе просвечивает от лампочки
    this.shade.setTint(this.isPossessed ? SHADE_POSSESSED : mixColor(SHADE, SHADE_LIT, p));

    // Свет качается вместе с лампой
    const rot = this.view.rotation;
    const bulbDown = this.bulb.y; // лампочка — на столько ниже потолка
    const bulbX = this.view.x - Math.sin(rot) * bulbDown;
    const bulbY = this.view.y + Math.cos(rot) * bulbDown;
    this.cone.setPosition(this.view.x, this.view.y).setRotation(rot).setAlpha(p);
    this.beam.setPosition(this.view.x, this.view.y).setRotation(rot).setAlpha(p * 0.1);
    this.halo.setPosition(bulbX, bulbY).setAlpha(p * 0.6);
    this.fill.setPosition(bulbX, bulbY).setAlpha(p * 0.4);
    this.shine.setPosition(bulbX, bulbY).setAlpha(p * 0.6);
  }
}
