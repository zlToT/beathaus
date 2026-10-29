// ============================================================
// Tooltip — 全局悬浮提示（挂 body，不受任何 overflow 裁剪）
// 任何带 data-tip 的元素，hover 时在其附近显示提示；
// 自动避开视口上下左右边缘
// ============================================================

export function initTooltip() {
  const tip = document.createElement('div');
  tip.id = 'global-tooltip';
  document.body.appendChild(tip);

  let current = null;

  function position(el) {
    // 先测量
    tip.style.left = '-9999px';
    tip.style.top = '-9999px';
    const bw = tip.offsetWidth;
    const bh = tip.offsetHeight;
    const r = el.getBoundingClientRect();

    let left = r.left + r.width / 2 - bw / 2;
    let top = r.top - bh - 8;
    if (top < 6) top = r.bottom + 8; // 上方不够 → 放下方
    left = Math.max(6, Math.min(window.innerWidth - bw - 6, left));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('[data-tip]');
    if (el) {
      current = el;
      tip.textContent = el.dataset.tip;
      tip.classList.add('show');
      position(el);
    } else if (current) {
      current = null;
      tip.classList.remove('show');
    }
  });

  // 滚动 / 窗口变化时隐藏，避免提示停在错位
  window.addEventListener('scroll', () => tip.classList.remove('show'), true);
  window.addEventListener('resize', () => tip.classList.remove('show'));
}
