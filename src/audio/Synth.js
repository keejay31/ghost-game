// Звуки без файлов: собираем их из простых волн через Web Audio
export class Synth {
  constructor(scene) {
    this.sound = scene.sound;
  }

  // Аудио-контекст Phaser; null — звук в браузере недоступен
  get ctx() {
    const ctx = this.sound.context;
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // Общий выход Phaser (через него работает общая громкость)
  get out() {
    return this.sound.destination ?? this.ctx?.destination ?? null;
  }

  // Отдельная «шина» — чтобы потом разом заглушить группу звуков
  bus() {
    const ctx = this.ctx;
    if (!ctx) return null;
    const g = ctx.createGain();
    g.connect(this.out);
    return g;
  }

  mute(bus) {
    if (bus) bus.gain.setTargetAtTime(0, bus.context.currentTime, 0.02);
  }

  // Нота старого пианино: частота (Гц), через сколько секунд, длительность, громкость
  note(freq, delay = 0, dur = 1.5, vol = 0.2, dest = this.out) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    env.connect(dest);

    // Основной тон + октава + чуть расстроенный тон — звучит «старым пианино»
    const parts = [
      [1, 'triangle', 1],
      [2, 'sine', 0.3],
      [1.006, 'sine', 0.4],
    ];
    for (const [mult, type, v] of parts) {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq * mult;
      const g = ctx.createGain();
      g.gain.value = v;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + dur);
    }
  }

  // Громкий «бабах»: шумовой удар + низкий гул + гудящие низкие струны
  bang(dest = this.out) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;

    // Шум удара
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const noise = ctx.createBufferSource();
    noise.buffer = buf;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.value = 0.9;
    noise.connect(lowpass).connect(ng).connect(dest);
    noise.start(t);

    // Низкий «бум»
    const thud = ctx.createOscillator();
    thud.frequency.setValueAtTime(90, t);
    thud.frequency.exponentialRampToValueAtTime(35, t + 0.4);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.9, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    thud.connect(tg).connect(dest);
    thud.start(t);
    thud.stop(t + 0.6);

    // Струны внутри гудят
    for (const f of [55, 58.27, 61.74, 82.41, 87.31]) this.note(f, 0.01, 2.5, 0.08, dest);
  }
}
