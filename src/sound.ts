// 効果音（Web Audio API で合成。音声ファイルや実機の音は使わない）

export type WinKind = 'big' | 'reg' | 'cherry' | 'bita';

interface ToneOptions {
  type?: OscillatorType;
  /** 終わりの周波数（指定すると指数的に変化） */
  freqEnd?: number;
  attack?: number;
  detune?: number;
  dest?: AudioNode;
}

// 停止音は第1→第2→第3停止で少しずつ高くする
const STOP_PITCH = [1, 1.12, 1.26];

export class Sound {
  enabled: boolean;
  private volume: number;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private spin: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null;
  private tenpaiHold: { gain: GainNode; sources: AudioScheduledSourceNode[] } | null = null;

  constructor(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
  }

  /** 音量 0〜1。聞こえ方が自然になるよう2乗して使う */
  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume * volume, this.ctx.currentTime, 0.02);
  }

  /** ブラウザの制約で、音はユーザー操作の中で初めて鳴らせる。pointerdown の中で呼ぶ */
  unlock(): void {
    if (!this.enabled) return;
    if (this.ctx === null) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      // 音圧をそろえて歯切れよくするためにコンプレッサーを通す
      const compressor = this.ctx.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.002;
      compressor.release.value = 0.12;
      compressor.connect(this.ctx.destination);
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * this.volume;
      this.master.connect(compressor);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopSpin(0);
      this.stopTenpai(0);
    }
  }

  /** レバー音: 重い「ガコッ」 */
  lever(): void {
    const audio = this.audio();
    if (!audio) return;
    const t = audio.ctx.currentTime;
    this.tone(110, t, 0.16, 0.9, { type: 'sine', freqEnd: 38 });
    this.noiseBurst(t, 0.012, 0.7, 'highpass', 3500);
    // 金属がぶつかる「ガシャ」
    for (let i = 0; i < 3; i++) this.noiseBurst(t + 0.02 + i * 0.018, 0.03, 0.3 / (i + 1), 'bandpass', 1800, 6);
  }

  /** 回転音: モーターのうなり＋図柄が通過する「ジャララ」（加速に合わせて速くなる） */
  startSpin(accelMs: number, symbolsPerSecond: number): void {
    const audio = this.audio();
    if (!audio || !this.noise) return;
    this.stopSpin(0);
    const { ctx, out } = audio;
    const t = ctx.currentTime;
    const accel = accelMs / 1000;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(1, t + accel);
    gain.connect(out);

    // うなり
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.setValueAtTime(25, t);
    hum.frequency.linearRampToValueAtTime(50, t + accel);
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 350;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.03;
    hum.connect(humFilter).connect(humGain).connect(gain);

    // 図柄の通過（ノイズを図柄の通過速度で刻む）
    const rattle = ctx.createBufferSource();
    rattle.buffer = this.noise;
    rattle.loop = true;
    const rattleFilter = ctx.createBiquadFilter();
    rattleFilter.type = 'bandpass';
    rattleFilter.frequency.value = 1100;
    rattleFilter.Q.value = 1.5;
    const rattleGain = ctx.createGain();
    rattleGain.gain.value = 0.015;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.setValueAtTime(2, t);
    lfo.frequency.linearRampToValueAtTime(symbolsPerSecond, t + accel);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.012;
    lfo.connect(lfoDepth).connect(rattleGain.gain);
    rattle.connect(rattleFilter).connect(rattleGain).connect(gain);

    for (const source of [hum, rattle, lfo]) source.start(t);
    this.spin = { gain, sources: [hum, rattle, lfo] };
  }

  /** 回っているリールが減ったら回転音を小さくする（spinning / total） */
  setSpinLevel(level: number, delayMs: number): void {
    if (!this.spin || !this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delayMs) / 1000;
    this.spin.gain.gain.setTargetAtTime(Math.max(0.0001, level), t, 0.02);
  }

  stopSpin(delayMs: number): void {
    if (!this.spin || !this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delayMs) / 1000;
    this.spin.gain.gain.setTargetAtTime(0.0001, t, 0.015);
    for (const source of this.spin.sources) source.stop(t + 0.1);
    this.spin = null;
  }

  /** 停止音: 歯切れのよい「ドカッ」。order は何番目に止めたか（0〜2） */
  stopClick(delayMs: number, order: number): void {
    const audio = this.audio();
    if (!audio) return;
    const t = audio.ctx.currentTime + Math.max(0, delayMs) / 1000;
    const pitch = STOP_PITCH[Math.min(order, STOP_PITCH.length - 1)];
    this.noiseBurst(t, 0.018, 0.9, 'highpass', 2500);
    this.tone(170 * pitch, t, 0.08, 0.85, { type: 'sine', freqEnd: 70 * pitch });
    this.tone(1200 * pitch, t, 0.012, 0.25, { type: 'square' });
  }

  /** テンパイ音: 上がっていく音のあと、最後のリールが止まるまできらきら鳴り続ける */
  tenpai(delayMs: number): void {
    const audio = this.audio();
    if (!audio) return;
    this.stopTenpai(0);
    const { ctx, out } = audio;
    const t = ctx.currentTime + Math.max(0, delayMs) / 1000;
    [1318.5, 1567.98, 1975.53].forEach((freq, i) => this.tone(freq, t + i * 0.06, 0.12, 0.3, { type: 'square' }));

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t + 0.18);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.3);
    gain.gain.setTargetAtTime(0.0001, t + 2.5, 0.3); // 押されないまま長引いたら自然に消える
    gain.connect(out);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 1975.53;
    const tremolo = ctx.createOscillator();
    tremolo.frequency.value = 12;
    const depth = ctx.createGain();
    depth.gain.value = 0.08;
    tremolo.connect(depth).connect(gain.gain);
    osc.connect(gain);
    osc.start(t + 0.18);
    tremolo.start(t + 0.18);
    this.tenpaiHold = { gain, sources: [osc, tremolo] };
  }

  stopTenpai(delayMs: number): void {
    if (!this.tenpaiHold || !this.ctx) return;
    const t = this.ctx.currentTime + Math.max(0, delayMs) / 1000;
    this.tenpaiHold.gain.gain.cancelScheduledValues(t);
    this.tenpaiHold.gain.gain.setTargetAtTime(0.0001, t, 0.02);
    for (const source of this.tenpaiHold.sources) source.stop(t + 0.15);
    this.tenpaiHold = null;
  }

  /** 成功音 */
  win(kind: WinKind): void {
    const audio = this.audio();
    if (!audio) return;
    const t = audio.ctx.currentTime + 0.05;
    switch (kind) {
      case 'big':
        this.fanfare(t, [523.25, 659.25, 783.99, 1046.5], [1046.5, 1318.5, 1567.98], 1.3);
        this.sparkles(t + 0.3, 14, 1.4);
        break;
      case 'reg':
        this.fanfare(t, [783.99, 1046.5, 1318.5], [1046.5, 1318.5], 0.6);
        this.sparkles(t + 0.25, 6, 0.7);
        break;
      case 'cherry':
        // コインのような「チャリン」を2回
        for (const offset of [0, 0.09]) {
          this.tone(2637, t + offset, 0.25, 0.3, { type: 'sine' });
          this.tone(3951, t + offset, 0.18, 0.18, { type: 'sine' });
        }
        break;
      case 'bita':
        this.tone(2093, t, 0.6, 0.35, { type: 'sine' });
        this.tone(3136, t, 0.45, 0.2, { type: 'sine' });
        this.tone(4186, t + 0.03, 0.3, 0.12, { type: 'sine' });
        break;
    }
  }

  private audio(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, out: this.master };
  }

  /** ブラス風の音で駆け上がってから和音を伸ばす */
  private fanfare(t: number, run: number[], chord: number[], hold: number): void {
    const step = 0.085;
    run.forEach((freq, i) => this.brass(freq, t + i * step, step * 1.4, 0.32));
    const chordAt = t + run.length * step;
    for (const freq of chord) this.brass(freq, chordAt, hold, 0.22, true);
  }

  private brass(freq: number, t: number, duration: number, volume: number, vibrato = false): void {
    const audio = this.audio();
    if (!audio) return;
    const { ctx, out } = audio;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, t);
    filter.frequency.exponentialRampToValueAtTime(3200, t + 0.04);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.setTargetAtTime(volume * 0.7, t + 0.05, 0.1);
    gain.gain.setTargetAtTime(0.0001, t + duration - 0.05, 0.06);
    filter.connect(gain).connect(out);
    for (const detune of [-7, 7]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      if (vibrato) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5.5;
        const depth = ctx.createGain();
        depth.gain.value = 9;
        lfo.connect(depth).connect(osc.detune);
        lfo.start(t);
        lfo.stop(t + duration + 0.3);
      }
      osc.connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.3);
    }
  }

  /** 高い音をランダムに散らす */
  private sparkles(t: number, count: number, span: number): void {
    for (let i = 0; i < count; i++) {
      const at = t + (span * i) / count + Math.random() * 0.05;
      this.tone(2500 + Math.random() * 2500, at, 0.12, 0.08, { type: 'sine' });
    }
  }

  private tone(freq: number, t: number, duration: number, volume: number, options: ToneOptions = {}): void {
    const audio = this.audio();
    if (!audio) return;
    const { ctx, out } = audio;
    const osc = ctx.createOscillator();
    osc.type = options.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (options.freqEnd) osc.frequency.exponentialRampToValueAtTime(options.freqEnd, t + duration);
    if (options.detune) osc.detune.value = options.detune;
    const gain = ctx.createGain();
    const attack = options.attack ?? 0.003;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(options.dest ?? out);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noiseBurst(t: number, duration: number, volume: number, type: BiquadFilterType, freq: number, q = 1): void {
    const audio = this.audio();
    if (!audio || !this.noise) return;
    const { ctx, out } = audio;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(out);
    // ノイズの開始位置をずらして毎回少し違う音にする
    source.start(t, Math.random() * 0.5);
    source.stop(t + duration + 0.01);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1秒
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
