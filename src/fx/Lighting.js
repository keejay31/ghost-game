import Phaser from 'phaser';

// Свет и темнота.
// Поверх комнаты лежит «карта света» — картинка во весь экран. Она залита цветом
// темноты, а каждый источник света рисует на ней светлое пятно. Карта умножается
// на комнату: где на карте светло — комнату видно как есть, где темно — она темнеет.

const SOFT = 128; // размер круглого пятна света

// Нарисовать пятно света по формуле: fn(x, y) возвращает яркость точки от 0 до 1
export function makeLightTexture(scene, key, w, h, fn) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  const img = tex.context.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Чуть-чуть шума, чтобы плавный переход не шёл «ступеньками»
      const a = fn(x + 0.5, y + 0.5) * 255 + Math.random() - 0.5;
      img.data.set([255, 255, 255, a], (y * w + x) * 4);
    }
  }
  tex.context.putImageData(img, 0, 0);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.LINEAR); // свет плавный, не пиксельный
}

// Смешать два цвета: t = 0 — первый, t = 1 — второй
export function mixColor(a, b, t) {
  const ch = (shift) => Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

export class Lighting {
  constructor(scene) {
    const { width, height } = scene.scale;
    this.scene = scene;
    this.lights = [];

    // Круглое мягкое пятно — подходит большинству источников
    makeLightTexture(scene, 'light-soft', SOFT, SOFT, (x, y) => {
      const d = Math.hypot(x - SOFT / 2, y - SOFT / 2) / (SOFT / 2);
      return d < 1 ? (1 - d * d) ** 2 : 0;
    });

    // Темнота: этим цветом залита карта там, куда свет не достаёт
    this.shade = new Phaser.GameObjects.Rectangle(scene, 0, 0, width, height, 0x000000).setOrigin(0);

    this.map = scene.add
      .renderTexture(0, 0, width, height)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.MULTIPLY)
      .setDepth(10);

    // Затемнение по углам экрана
    makeLightTexture(scene, 'vignette', width, height, (x, y) => {
      const d = Math.hypot((x - width / 2) / width, (y - height / 2) / height) * 2;
      return Phaser.Math.SmoothStep(d, 0.6, 1.4) * 0.6;
    });
    scene.add.image(0, 0, 'vignette').setOrigin(0).setTint(0x000000).setDepth(25);
  }

  // Цвет темноты: 0x000000 — полная тьма, 0xffffff — темноты нет
  setAmbient(color) {
    this.shade.fillColor = color;
  }

  // Источник света: освещает комнату. texture — форма пятна, color — цвет света
  addLight(texture, color) {
    const light = this.scene.make.image({ key: texture }, false);
    light.setTint(color).setBlendMode(Phaser.BlendModes.ADD);
    this.lights.push(light);
    return light;
  }

  // Свечение поверх темноты: само ничего не освещает, но сияет (лампочка, лучи, луна)
  addGlow(texture, color) {
    return this.scene.add
      .image(0, 0, texture)
      .setTint(color)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(11);
  }

  // Каждый кадр карта света рисуется заново
  update() {
    const lit = this.lights.filter((light) => light.visible && light.alpha > 0);
    this.map.clear().draw([this.shade, ...lit]);
  }
}
