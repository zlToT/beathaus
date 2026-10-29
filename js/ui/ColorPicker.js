// ============================================================
// ColorPicker — 右侧主色调拾取器
// 色板 / 色相 / RGB / 预设四者双向同步，变化即全局联动
// ============================================================

import { state } from '../state.js';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '../stage/colorUtils.js';

export class ColorPicker {
  constructor(onColor) {
    this.onColor = onColor;
    this.colorInput = document.getElementById('color-input');
    this.hue = document.getElementById('color-hue');
    this.r = document.getElementById('color-r');
    this.g = document.getElementById('color-g');
    this.b = document.getElementById('color-b');
    this.toggle = document.getElementById('color-picker-toggle');
    this.body = document.getElementById('color-picker-body');

    this.colorInput.addEventListener('input', () => this.apply(this.colorInput.value, ['input']));
    this.hue.addEventListener('input', () => {
      const { r, g, b } = hexToRgb(this.colorInput.value);
      const { s, l } = rgbToHsl(r, g, b);
      const c = hslToRgb(parseFloat(this.hue.value), s, l);
      this.apply(rgbToHex(c.r, c.g, c.b), ['input', 'rgb']);
    });
    [this.r, this.g, this.b].forEach((el) => {
      el.addEventListener('input', () => {
        this.apply(
          rgbToHex(
            parseInt(this.r.value) || 0,
            parseInt(this.g.value) || 0,
            parseInt(this.b.value) || 0
          ),
          ['input', 'hue']
        );
      });
    });
    document.querySelectorAll('.preset-swatch').forEach((sw) => {
      sw.addEventListener('click', () => this.apply(sw.dataset.color));
    });

    // 折叠（默认收起，需要时点击 [+] 展开）
    let collapsed = true;
    this.toggle.addEventListener('click', () => {
      collapsed = !collapsed;
      this.body.style.display = collapsed ? 'none' : 'block';
      this.toggle.textContent = collapsed ? '[+]' : '[—]';
    });
    
    this.apply(state.vj.primaryColor);
  }

  // 同步所有控件（skip 中的来源不回写，避免光标跳动）
  apply(hex, skip = []) {
    const { r, g, b } = hexToRgb(hex);
    const { h } = rgbToHsl(r, g, b);
    if (!skip.includes('input')) this.colorInput.value = hex;
    if (!skip.includes('hue')) this.hue.value = Math.round(h);
    if (!skip.includes('rgb')) {
      this.r.value = r;
      this.g.value = g;
      this.b.value = b;
    }
    state.vj.primaryColor = hex;
    document.documentElement.style.setProperty('--primary', hex);
    document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    this.onColor(hex);
  }
}
