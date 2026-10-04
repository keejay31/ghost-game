import Phaser from 'phaser';

// Цвета лампы (заглушки)
const CORD = 0x0a0810;
const SHADE = 0x6b4f7a;
const SHADE_POSSESSED = 0xa8c4ff; // абажур, когда внутри призрак
const BULB_ON = 0xfff2b0;
const BULB_OFF = 0x6b6455;
const BULB_BROKEN = 0x2e2a26;
const GLOW = 0xffd98a;
const GLASS = 0xe8f4ff;

const CORD_LEN = 36;
const SHADE_W = 26;
const SHADE_H = 12;

// Лампа на шнуре под потолком
export class Lamp {
  constructor(scene, x, ceilingY, floorY) {
    this.scene = scene;
    this.floorY = floorY;
    this.isOn = true;
    this.isBroken = false;
    this.isPossessed = false;
    this.time = 0;

    // Сюда подписываются те, кому важен свет (потом — люди)
    this.events = new Phaser.Events.EventEmitter();

    // Центр абажура — к нему подлетает призрак
    this.x = x;
    this.y = ceilingY + CORD_LEN + SHADE_H / 2;

    // Конус света до пола и пятно на полу
    const toFloor = floorY - ceilingY;
    const shadeBottom = CORD_LEN + SHADE_H;
    this.glow = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    this.glow.fillStyle(GLOW, 0.06);
    this.glow.fillPoints(
      [
        { x: -SHADE_W / 2, y: shadeBottom },
        { x: SHADE_W / 2, y: shadeBottom },
        { x: 120, y: toFloor },
        { x: -120, y: toFloor },
      ],
      true,
    );
    this.glow.fillStyle(GLOW, 0.05);
    this.glow.fillPoints(
      [
        { x: -6, y: shadeBottom },
        { x: 6, y: shadeBottom },
        { x: 60, y: toFloor },
        { x: -60, y: toFloor },
      ],
      true,
    );
    this.glow.fillStyle(GLOW, 0.08);
    this.glow.fillEllipse(0, toFloor + 6, 240, 16);

    const cord = scene.add.rectangle(0, 0, 2, CORD_LEN, CORD).setOrigin(0.5, 0);
    this.shade = scene.add.rectangle(0, CORD_LEN, SHADE_W, SHADE_H, SHADE).setOrigin(0.5, 0);
    this.bulb = scene.add.rectangle(0, shadeBottom + 2, 6, 4, BULB_ON);

    // Глаза призрака на абажуре — видны, только когда он внутри
    const eyeY = CORD_LEN + 5;
    this.eyes = [
      scene.add.rectangle(-4, eyeY, 3, 4, 0x0e0b14),
      scene.add.rectangle(4, eyeY, 3, 4, 0x0e0b14),
    ];
    this.eyes.forEach((e) => e.setVisible(false));

    // Всё вместе качается вокруг точки на потолке
    this.view = scene.add.container(x, ceilingY, [this.glow, cord, this.shade, this.bulb, ...this.eyes]);
  }

  setPossessed(value) {
    this.isPossessed = value;
    this.shade.fillColor = value ? SHADE_POSSESSED : SHADE;
    this.eyes.forEach((e) => e.setVisible(value));
  }

  // Свет вкл/выкл
  toggle() {
    if (this.isBroken) return;
    this.isOn = !this.isOn;
    this.applyLight();
  }

  // Лопнуть лампочку — навсегда
  pop() {
    if (this.isBroken) return;
    this.isBroken = true;
    this.isOn = false;
    this.applyLight();

    const cam = this.scene.cameras.main;
    cam.flash(100, 255, 245, 210);
    cam.shake(150, 0.005);
    this.spawnShards();
    this.events.emit('pop');
  }

  applyLight() {
    this.glow.setVisible(this.isOn);
    if (this.isBroken) this.bulb.fillColor = BULB_BROKEN;
    else this.bulb.fillColor = this.isOn ? BULB_ON : BULB_OFF;
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
  }
}
