import Phaser from 'phaser';
import { makeLightTexture } from '../fx/Lighting.js';

// Цвета окна (заглушки)
const FRAME = 0x7a6490;
const SKY = 0x16264a;
const BARS = 0x1d1828; // переплёт — тёмный силуэт на фоне неба
const MOON = 0xe6f0ff;
const MOONLIGHT = 0x9fc4ff; // холодный лунный свет

const SIZE = 96; // стекло
const BORDER = 4; // толщина рамы

// Пятно лунного света на полу — окно, «упавшее» на пол наискосок.
// Низ окна падает ближе к стене, верх — дальше, и всё уезжает влево
const NEAR = { y: 10, slide: 60 };
const FAR = { y: 50, slide: 110 };

const smooth = Phaser.Math.SmoothStep;

// Окно с луной. x, y — левый верхний угол стекла
export class MoonWindow {
  constructor(scene, x, y, floorY) {
    scene.add.rectangle(x - BORDER, y - BORDER, SIZE + BORDER * 2, SIZE + BORDER * 2, FRAME).setOrigin(0);
    scene.add.rectangle(x, y, SIZE, SIZE, SKY).setOrigin(0);
    scene.add.rectangle(x + 66, y + 18, 14, 14, MOON).setOrigin(0);
    scene.add.rectangle(x + SIZE / 2 - 2, y, 4, SIZE, BARS).setOrigin(0);
    scene.add.rectangle(x, y + SIZE / 2 - 2, SIZE, 4, BARS).setOrigin(0);

    const lighting = scene.lighting;

    // Небо за окном не темнеет, когда в комнате гаснет свет
    lighting.addLight('__WHITE', 0xffffff).setOrigin(0).setPosition(x, y).setDisplaySize(SIZE, SIZE);
    // Луна сияет, стена вокруг окна чуть подсвечена
    lighting.addGlow('light-soft', MOON).setPosition(x + 73, y + 25).setDisplaySize(56, 56).setAlpha(0.5);
    lighting
      .addLight('light-soft', MOONLIGHT)
      .setPosition(x + SIZE / 2, y + SIZE / 2)
      .setDisplaySize(280, 280)
      .setAlpha(0.3);

    const nearY = floorY + NEAR.y;
    const farY = floorY + FAR.y;

    // Пятно на полу
    const patch = { x: x - FAR.slide - 4, y: nearY - 4, w: SIZE + FAR.slide - NEAR.slide + 8, h: farY - nearY + 8 };
    makeLightTexture(scene, 'moon-patch', patch.w, patch.h, (px, py) => {
      const v = (py + patch.y - nearY) / (farY - nearY); // 0 — низ окна, 1 — верх
      const left = x - NEAR.slide - (FAR.slide - NEAR.slide) * v;
      const u = (px + patch.x - left) / SIZE; // 0 — левый край окна, 1 — правый
      if (u < 0 || u > 1 || v < 0 || v > 1) return 0;
      const du = Math.min(u, 1 - u) * SIZE; // пикселей до края пятна
      const dv = Math.min(v, 1 - v) * (farY - nearY);
      // Тень от переплёта — крест посередине
      const bars = smooth(Math.abs(u - 0.5) * SIZE, 1.5, 4) * smooth(Math.abs(v - 0.5) * (farY - nearY), 1, 3);
      return smooth(Math.min(du, dv), 0, 3) * bars;
    });
    lighting.addLight('moon-patch', MOONLIGHT).setOrigin(0).setPosition(patch.x, patch.y).setAlpha(0.6);

    // Луч в воздухе: от стекла до пятна на полу
    const corners = [
      [x, y],
      [x + SIZE, y],
      [x + SIZE, y + SIZE],
      [x + SIZE - NEAR.slide, nearY],
      [x + SIZE - FAR.slide, farY],
      [x - FAR.slide, farY],
    ];
    const shaft = { x: x - FAR.slide - 8, y: y - 8, w: SIZE + FAR.slide + 16, h: farY - y + 16 };
    // Направление луча — от середины окна к середине пятна
    const dir = new Phaser.Math.Vector2(-(NEAR.slide + FAR.slide) / 2, (nearY + farY) / 2 - y - SIZE / 2).normalize();
    makeLightTexture(scene, 'moon-shaft', shaft.w, shaft.h, (px, py) => {
      const sx = px + shaft.x;
      const sy = py + shaft.y;
      // Сколько пикселей до ближайшего края луча (меньше нуля — снаружи)
      let inside = Infinity;
      corners.forEach(([ax, ay], i) => {
        const [bx, by] = corners[(i + 1) % corners.length];
        const d = ((bx - ax) * (sy - ay) - (by - ay) * (sx - ax)) / Math.hypot(bx - ax, by - ay);
        inside = Math.min(inside, d);
      });
      if (inside <= 0) return 0;
      const across = sx * dir.y - sy * dir.x; // поперёк луча — для полосок
      const streaks = 0.75 + 0.25 * Math.sin(across * 0.45) * Math.sin(across * 0.17 + 1);
      const fade = 1 - 0.5 * ((sy - y) / (farY - y)); // у пола луч слабее
      return smooth(inside, 0, 8) * streaks * fade;
    });
    lighting.addLight('moon-shaft', MOONLIGHT).setOrigin(0).setPosition(shaft.x, shaft.y).setAlpha(0.15);
    lighting.addGlow('moon-shaft', MOONLIGHT).setOrigin(0).setPosition(shaft.x, shaft.y).setAlpha(0.1);
  }
}
