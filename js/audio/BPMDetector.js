// ============================================================
// BPMDetector — 离线 BPM 检测
// 思路：低频能量包络 → onset 强度信号（局部归一化）→ 自相关找节拍周期
// ============================================================

export class BPMDetector {
  static async detect(buffer) {
    // 让出主线程，避免阻塞 UI
    await new Promise((r) => setTimeout(r, 0));

    const sr = buffer.sampleRate;
    const ch0 = buffer.getChannelData(0);
    const ch1 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const n = ch0.length;

    // 1. 块 RMS 能量包络（包络采样率 ≈ 200 Hz）
    const envRate = 200;
    const block = Math.max(1, Math.round(sr / envRate));
    const total = Math.floor(n / block);
    const env = new Float32Array(total);
    for (let i = 0; i < total; i++) {
      let sum = 0;
      const start = i * block;
      for (let j = 0; j < block; j++) {
        let x = ch0[start + j];
        if (ch1) x = (x + ch1[start + j]) * 0.5;
        sum += x * x;
      }
      env[i] = Math.sqrt(sum / block);
    }

    // 2. 分析窗口：跳过前 15s，取最多 60s
    const skip = Math.max(0, Math.min(env.length - envRate * 10, Math.floor(15 * envRate)));
    const winLen = Math.min(env.length - skip, Math.floor(60 * envRate));
    if (winLen < envRate * 10) return null;

    // 3. onset 强度（正向差分），局部均值归一化
    const onset = new Float32Array(winLen);
    const normWin = Math.floor(0.5 * envRate);
    for (let i = 1; i < winLen; i++) {
      const gi = i + skip;
      const d = Math.max(0, env[gi] - env[gi - 1]);
      const from = Math.max(0, i - normWin);
      let local = 0;
      for (let j = from; j < i; j++) local += env[j + skip];
      local /= Math.max(1, i - from);
      onset[i] = local > 1e-6 ? d / local : 0;
    }

    // 4. 自相关（lag 对应 BPM 80–160）
    const minBpm = 80;
    const maxBpm = 160;
    const minLag = Math.floor(envRate * 60 / maxBpm);
    const maxLag = Math.ceil(envRate * 60 / minBpm);
    const scoreAt = (lag) => {
      let s = 0;
      for (let i = 0; i < winLen - lag; i++) s += onset[i] * onset[i + lag];
      return s / (winLen - lag);
    };
    let bestLag = -1;
    let bestScore = -1;
    for (let lag = minLag; lag <= maxLag; lag++) {
      const s = scoreAt(lag);
      if (s > bestScore) { bestScore = s; bestLag = lag; }
    }
    if (bestLag < 0 || bestScore <= 0) return null;

    // 5. 抛物线插值，提高分辨率
    const s0 = scoreAt(bestLag - 1);
    const s2 = scoreAt(bestLag + 1);
    const denom = s0 - 2 * bestScore + s2;
    const shift = denom !== 0 ? 0.5 * (s0 - s2) / denom : 0;
    let bpm = (60 * envRate) / (bestLag + shift);

    // 折叠到电子乐常用区间
    while (bpm < 90) bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return Math.round(bpm);
  }
}
