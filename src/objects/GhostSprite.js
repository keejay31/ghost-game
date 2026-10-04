// Живой спрайт призрака: из одной картинки автора собирает кадры —
// взгляд влево/вправо, наклон в полёте, волна по хвосту, моргание.
// Всё сдвигами целых пикселей, без размытия.

const PAD = 3; // запас по бокам картинки для сдвигов

export class GhostSprite {
  constructor(scene, sourceKey, key) {
    const src = scene.textures.get(sourceKey).getSourceImage();
    this.w = src.width;
    this.h = src.height;
    this.key = key;
    this.lastState = '';

    // Читаем пиксели картинки
    const canvas = document.createElement('canvas');
    canvas.width = this.w;
    canvas.height = this.h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    this.px = ctx.getImageData(0, 0, this.w, this.h).data;

    this.findFace();

    if (scene.textures.exists(key)) scene.textures.remove(key);
    this.tex = scene.textures.createCanvas(key, this.w + PAD * 2, this.h);
    this.draw(0, 0, 0, false);
  }

  alpha(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[(y * this.w + x) * 4 + 3];
  }

  color(x, y) {
    const i = (y * this.w + x) * 4;
    return this.px.subarray(i, i + 4);
  }

  // Лицо — самые тёмные пиксели внутри тела (глаза и рот)
  findFace() {
    const isFace = (x, y) => {
      const [r, g, b, a] = this.color(x, y);
      if (a === 0 || r + g + b > 150) return false;
      return this.alpha(x - 1, y) && this.alpha(x + 1, y) && this.alpha(x, y - 1) && this.alpha(x, y + 1);
    };
    const face = new Map(); // "x,y" -> {x, y}
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (isFace(x, y)) face.set(`${x},${y}`, { x, y });
      }
    }

    // Область лица с запасом в пиксель — она сдвигается целиком, вместе с ободком
    const pts = [...face.values()];
    this.box = pts.length
      ? {
          x0: Math.min(...pts.map((p) => p.x)) - 1,
          x1: Math.max(...pts.map((p) => p.x)) + 1,
          y0: Math.min(...pts.map((p) => p.y)) - 1,
          y1: Math.max(...pts.map((p) => p.y)) + 1,
        }
      : null;

    // Делим лицо на части: связные группы пикселей
    const groups = [];
    const seen = new Set();
    for (const start of pts) {
      if (seen.has(`${start.x},${start.y}`)) continue;
      const group = [];
      const stack = [start];
      seen.add(`${start.x},${start.y}`);
      while (stack.length) {
        const p = stack.pop();
        group.push(p);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const id = `${p.x + dx},${p.y + dy}`;
          if (face.has(id) && !seen.has(id)) {
            seen.add(id);
            stack.push(face.get(id));
          }
        }
      }
      groups.push(group);
    }

    // Рот — самая нижняя часть, остальное — глаза.
    // Веко при моргании: всё, кроме нижнего ряда глаза, цветом кожи над глазом
    this.lids = new Map();
    const top = (g) => Math.min(...g.map((p) => p.y));
    const mouthTop = Math.max(...groups.map(top));
    for (const g of groups) {
      if (groups.length < 2 || top(g) === mouthTop) continue;
      const gTop = top(g);
      const gBottom = Math.max(...g.map((p) => p.y));
      for (const p of g) {
        if (p.y !== gBottom) this.lids.set(`${p.x},${p.y}`, this.color(p.x, gTop - 1));
      }
    }
  }

  // Сдвиг строки y: наклон (макушка вперёд, хвост назад) + волна по хвосту
  rowShift(y, lean, phase) {
    const t = y / (this.h - 1); // 0 — макушка, 1 — низ
    let s = lean * (1 - 2 * t);
    const tail = Math.max(0, (t - 0.55) / 0.45);
    s += Math.sin(phase - y * 0.6) * tail * 1.2;
    // Округляем одинаково влево и вправо (Math.round(-0.5) даёт 0, а не -1)
    return Math.sign(s) * Math.round(Math.abs(s));
  }

  // Откуда брать пиксель (x, y) с учётом поворота лица на look пикселей
  sourceX(x, y, look) {
    const b = this.box;
    if (!b || y < b.y0 || y > b.y1) return x;
    const sx = x - look;
    if (sx >= b.x0 && sx <= b.x1) return sx; // лицо на новом месте
    // Освободившееся место — цвет соседа снаружи
    if (look > 0 && x >= b.x0 && x < b.x0 + look) return b.x0 - 1;
    if (look < 0 && x <= b.x1 && x > b.x1 + look) return b.x1 + 1;
    return x;
  }

  // look — поворот лица в пикселях, lean — наклон, phase — фаза волны, blink — глаза закрыты
  draw(look, lean, phase, blink) {
    const state = `${look}|${lean}|${phase}|${blink}`;
    if (state === this.lastState) return;
    this.lastState = state;

    const W = this.w + PAD * 2;
    const out = new ImageData(W, this.h);
    for (let y = 0; y < this.h; y++) {
      const shift = this.rowShift(y, lean, phase);
      for (let x = 0; x < this.w; x++) {
        const sx = this.sourceX(x, y, look);
        if (!this.alpha(sx, y)) continue;
        const lid = blink && this.lids.get(`${sx},${y}`);
        out.data.set(lid || this.color(sx, y), (y * W + x + PAD + shift) * 4);
      }
    }

    this.tex.context.putImageData(out, 0, 0);
    this.tex.refresh();
  }
}
