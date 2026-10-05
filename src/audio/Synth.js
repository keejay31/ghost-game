// Звуки без файлов: собираем их из простых волн через Web Audio
export class Synth {
  constructor(scene) {
    this.sound = scene.sound;
  }

  // Аудио-контекст Phaser; null — звук в браузере недоступен
  get ctx() {
    const ctx = this.sound.context;
    if (!ctx) return null;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {}); // браузер мог не разрешить — не страшно
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

  // Шумовой удар, который быстро затихает. filter — 'lowpass' (глухо) или 'highpass'/'bandpass' (звонко)
  noise(dur, vol, filter, freq, delay = 0, dest = this.out) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(dest);
    src.start(t);
  }

  // Короткий затухающий тон; toFreq — куда «съезжает» высота
  tone(freq, dur, vol, { type = 'sine', delay = 0, toFreq = freq, dest = this.out } = {}) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (toFreq !== freq) osc.frequency.exponentialRampToValueAtTime(toFreq, t + dur * 0.7);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur);
  }

  // Громкий «бабах»: шумовой удар + низкий гул + гудящие низкие струны
  bang() {
    this.noise(0.5, 0.6, 'lowpass', 900);
    this.tone(90, 0.6, 0.6, { toFreq: 35 });
    for (const f of [55, 58.27, 61.74, 82.41, 87.31]) this.note(f, 0.01, 2.5, 0.08);
  }

  // Щелчок выключателя: включить — чуть выше, выключить — чуть ниже
  click(on) {
    this.noise(0.02, 0.22, 'highpass', 2500);
    this.tone(on ? 1900 : 1300, 0.03, 0.06, { type: 'square' });
  }

  // Лампочка лопнула: хлопок + звон стекла
  shatter() {
    this.noise(0.08, 0.7, 'lowpass', 1500);
    this.tone(160, 0.12, 0.4, { toFreq: 60 });
    this.noise(0.3, 0.35, 'bandpass', 4000, 0.01);
    for (let i = 0; i < 6; i++) this.tink(Math.random() * 0.15);
  }

  // Скрип двери: тон ползёт вверх
  creak() {
    this.tone(280, 0.3, 0.05, { type: 'sawtooth', toFreq: 470 });
    this.tone(560, 0.25, 0.025, { type: 'square', toFreq: 720, delay: 0.05 });
  }

  // Дверь закрылась: тихий стук или громкий хлопок
  slam(loud) {
    this.noise(0.12, loud ? 0.6 : 0.2, 'lowpass', 500);
    this.tone(110, 0.18, loud ? 0.4 : 0.12, { toFreq: 50 });
  }

  // Глаза портрета загорелись: тонкий звон и низкий гул
  stare() {
    this.tone(1318, 0.7, 0.05);
    this.tone(1976, 0.9, 0.03, { delay: 0.06 });
    this.tone(82, 0.9, 0.1, { toFreq: 78 });
  }

  // «БУ!»: голос съезжает вниз, плюс выдох
  boo() {
    this.tone(260, 0.5, 0.3, { type: 'sawtooth', toFreq: 95 });
    this.tone(130, 0.55, 0.35, { toFreq: 60 });
    this.noise(0.25, 0.3, 'lowpass', 700);
  }

  // Звяк осколка
  tink(delay = 0) {
    const freq = 3000 + Math.random() * 4000;
    this.tone(freq, 0.12, 0.09, { delay, toFreq: freq * 0.97 });
  }
}
