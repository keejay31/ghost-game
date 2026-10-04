import Phaser from 'phaser';
import { RoomScene } from './scenes/RoomScene.js';

// Размер игры в «настоящих» пикселях
const WIDTH = 640;
const HEIGHT = 360;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#000000',
  pixelArt: true, // без сглаживания
  scale: {
    mode: Phaser.Scale.NONE, // масштаб считаем сами
  },
  scene: [RoomScene],
});

// Увеличиваем только в целое число раз: x1, x2, x3...
function fitIntegerZoom() {
  const zoom = Math.max(
    1,
    Math.floor(Math.min(window.innerWidth / WIDTH, window.innerHeight / HEIGHT)),
  );
  game.scale.setZoom(zoom);
}

window.addEventListener('resize', fitIntegerZoom);
game.events.once('ready', fitIntegerZoom);

// Для отладки: в режиме разработки игра доступна в консоли браузера как window.game
if (import.meta.env.DEV) window.game = game;
