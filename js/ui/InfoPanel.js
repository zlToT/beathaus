// ============================================================
// InfoPanel — 右上角实时信息面板
// ============================================================

export class InfoPanel {
  constructor() {
    this.elEnergy = document.getElementById('info-energy');
    this.elBass = document.getElementById('info-bass');
    this.elBpm = document.getElementById('info-bpm');
    this.elSection = document.getElementById('info-section');
  }

  update(a) {
    this.elEnergy.textContent = `${Math.round(a.energy)}%`;
    this.elBass.textContent = `${Math.round(a.bass * 100)}%`;
    this.elBpm.textContent = a.bpm != null ? a.bpm : '--';
    this.elSection.textContent = a.section || '--';
  }
}
