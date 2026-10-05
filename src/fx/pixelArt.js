// Пиксель-арт кодом: рисуем на маленьком холсте прямоугольниками, точками, линиями
// и «рисунками из букв»

const css = (color) => '#' + color.toString(16).padStart(6, '0');

export class Brush {
  constructor(ctx) {
    this.ctx = ctx;
  }

  // Прямоугольник. alpha меньше 1 — полупрозрачный (тени, блики, грязь)
  rect(x, y, w, h, color, alpha = 1) {
    this.ctx.globalAlpha = alpha;
    this.ctx.fillStyle = css(color);
    this.ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  dot(x, y, color, alpha = 1) {
    this.rect(x, y, 1, 1, color, alpha);
  }

  // Линия из пикселей
  line(x0, y0, x1, y1, color, alpha = 1) {
    const steps = Math.max(Math.round(Math.abs(x1 - x0)), Math.round(Math.abs(y1 - y0)), 1);
    for (let i = 0; i <= steps; i++) {
      this.dot(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, color, alpha);
    }
  }

  // Рисунок из букв: строка — ряд пикселей, буква — цвет из palette, точка — пусто
  stamp(x, y, rows, palette) {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (palette[ch] !== undefined) this.dot(x + i, y + j, palette[ch]);
      });
    });
  }
}

// Создать картинку key размером w×h и нарисовать её функцией paint(brush)
export function makeArt(scene, key, w, h, paint) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  paint(new Brush(tex.context));
  tex.refresh();
  return tex;
}
