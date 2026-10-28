// 効果音（Web Audio API で合成。音声ファイルや実機の音は使わない）

export type WinKind = 'big' | 'reg' | 'cherry' | 'bita';

// 成功音の音階（Hz）
const WIN_NOTES: Record<WinKind, number[]> = {
  big: [523.25, 659.25, 783.99, 1046.5, 1318.5],
  reg: [523.25, 783.99, 1046.5],
  cherry: [1318.5, 1567.98],
  bita: [1046.5, 1567.98],
};

export class Sound {
  enabled: boolean;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private spin: { source: AudioBufferSourceNode; gain: GainNode } | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  /** ブラウザの制約で、音はユーザー操作の中で初めて鳴らせる。pointerdown の中で呼ぶ */
  unlock(): void {
    if (!this.enabled) return;
    if (this.ctx === null) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopSpin(0);
  }

  /** スタート（レバー）音 */
  lever(): void {
    const audio = this.audio();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime;
    // 低い「ドン」
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.16);
    // 金属的な「ガシャ」
    this.noiseBurst(t, 0.05, 0.35, 'bandpass', 2500);
  }

  /** 回転中の音（止めるまで鳴り続ける） */
  startSpin(): void {
    const audio = this.audio();
    if (!audio || !this.noise) return;
    this.stopSpin(0);
    const { ctx, out } = audio;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.3); // 加速に合わせて大きくする
    source.connect(filter).connect(gain).connect(out);
    source.start(t);
    this.spin = { source, gain };
  }

  /** delayMs 後に回転音を止める */
  stopSpin(delayMs: number): void {
    if (!this.spin || !this.ctx) return;
    const { source, gain } = this.spin;
    const t = this.ctx.currentTime + Math.max(0, delayMs) / 1000;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + 0.05);
    source.stop(t + 0.06);
    this.spin = null;
  }

  /** delayMs 後に停止音「カチッ」を鳴らす（画面上でリールが止まる時刻に合わせる） */
  stopClick(delayMs: number): void {
    const audio = this.audio();
    if (!audio) return;
    const { ctx, out } = audio;
    const t = ctx.currentTime + Math.max(0, delayMs) / 1000;
    this.noiseBurst(t, 0.025, 0.6, 'highpass', 3000);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(220, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** 成功音 */
  win(kind: WinKind): void {
    const audio = this.audio();
    if (!audio) return;
    const { ctx, out } = audio;
    const step = kind === 'big' ? 0.09 : 0.1;
    WIN_NOTES[kind].forEach((freq, i) => {
      const t = ctx.currentTime + 0.05 + i * step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  }

  private audio(): { ctx: AudioContext; out: GainNode } | null {
    if (!this.enabled || !this.ctx || !this.master) return null;
    return { ctx: this.ctx, out: this.master };
  }

  private noiseBurst(t: number, duration: number, volume: number, type: BiquadFilterType, freq: number): void {
    const audio = this.audio();
    if (!audio || !this.noise) return;
    const { ctx, out } = audio;
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    source.connect(filter).connect(gain).connect(out);
    source.start(t);
    source.stop(t + duration + 0.01);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1秒
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }
}
