export class Hud {
  constructor() {
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="vignette"></div>
      <div class="flash"></div>
      <div class="boss-panel">
        <div class="boss-meta"><span class="boss-stage"></span><span class="boss-name"></span><span class="boss-title"></span></div>
        <div class="boss-bar"><div class="boss-bar-lag"></div><div class="boss-bar-fill"></div><div class="boss-bar-mark"></div></div>
        <div class="boss-shield"></div>
      </div>
      <div class="pops"></div>
      <div class="player-panel">
        <div class="hearts"></div>
        <div class="held"><span class="held-icon"></span><span class="held-text">TONGUE READY</span></div>
        <div class="dash"><span class="dash-dot"></span>DASH <kbd>SHIFT</kbd></div>
      </div>
      <div class="timer"></div>
      <div class="banner"><div class="banner-kicker"></div><div class="banner-title"></div><div class="banner-sub"></div></div>
      <div class="title-card">
        <div class="title-kicker">TODE THE FROG IN</div>
        <div class="title-logo">BOSS<span>RUSH</span></div>
        <div class="title-sub">Four titans. One frog. No mercy.</div>
        <div class="title-controls">
          <div><kbd>W A S D</kbd> move &nbsp; <kbd>MOUSE</kbd> aim</div>
          <div><kbd>CLICK</kbd> / <kbd>J</kbd> tongue: lash enemies, grab rubble, grapple pillars</div>
          <div><kbd>CLICK</kbd> again while holding rubble to throw it</div>
          <div><kbd>SPACE</kbd> jump over shockwaves &nbsp; <kbd>SHIFT</kbd> dash</div>
          <div class="title-tip">Shields? Break the wards, beat the guards, or hurl rubble.</div>
        </div>
        <div class="title-start">PRESS SPACE TO FIGHT</div>
      </div>
    `;
    document.body.appendChild(this.root);
    const q = (s) => this.root.querySelector(s);
    this.panel = q('.boss-panel');
    this.stage = q('.boss-stage');
    this.name = q('.boss-name');
    this.title = q('.boss-title');
    this.fill = q('.boss-bar-fill');
    this.lag = q('.boss-bar-lag');
    this.hearts = q('.hearts');
    this.held = q('.held');
    this.heldText = q('.held-text');
    this.shieldEl = q('.boss-shield');
    this.pops = q('.pops');
    this.dash = q('.dash');
    this.timer = q('.timer');
    this.banner = q('.banner');
    this.bannerKicker = q('.banner-kicker');
    this.bannerTitle = q('.banner-title');
    this.bannerSub = q('.banner-sub');
    this.titleCard = q('.title-card');
    this.flashEl = q('.flash');
    this.vignette = q('.vignette');
    this.lagValue = 1;
    this.lastHp = -1;
    this.lastShield = null;
    this.lastHeld = null;
  }

  setBoss(index, total, def) {
    this.stage.textContent = `${index + 1}/${total}`;
    this.name.textContent = def.name;
    this.title.textContent = def.title;
    this.setBossColor(def.color);
    this.panel.classList.remove('enraged');
    this.lagValue = 1;
  }

  setBossColor(color) {
    this.panel.style.setProperty('--boss-color', `#${color.toString(16).padStart(6, '0')}`);
  }

  setEnraged() {
    this.panel.classList.add('enraged');
  }

  showBossPanel(show) {
    this.panel.classList.toggle('visible', show);
  }

  setBossHp(ratio, dt, instant = false) {
    const r = Math.max(ratio, 0);
    this.fill.style.width = `${r * 100}%`;
    this.lagValue = instant ? r : Math.max(r, this.lagValue - dt * 0.4);
    this.lag.style.width = `${this.lagValue * 100}%`;
  }

  setHearts(hp, max) {
    if (hp === this.lastHp) return;
    this.lastHp = hp;
    this.hearts.innerHTML = Array.from({ length: max }, (_, i) => `<span class="heart ${i < hp ? 'full' : 'empty'}"></span>`).join('');
  }

  setHeld(state) {
    if (state === this.lastHeld) return;
    this.lastHeld = state;
    this.held.className = `held ${state}`;
    this.heldText.textContent = state === 'rock' ? 'HOLDING RUBBLE · CLICK TO THROW' : state === 'zip' ? 'GRAPPLING!' : 'TONGUE READY';
  }

  setShield(text, exposed) {
    const key = `${text}|${exposed}`;
    if (key === this.lastShield) return;
    this.lastShield = key;
    this.shieldEl.textContent = text ?? '';
    this.shieldEl.className = `boss-shield ${text ? 'on' : ''} ${exposed ? 'exposed' : ''}`;
    this.panel.classList.toggle('shielded', !!text && !exposed);
  }

  pop(text, x, y, cls = '') {
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    this.pops.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  setDash(ready) {
    this.dash.classList.toggle('ready', ready);
  }

  setTime(seconds) {
    this.timer.textContent = `${seconds.toFixed(1)}s`;
  }

  showTitle(show) {
    this.titleCard.classList.toggle('visible', show);
  }

  showBanner(title, sub = '', variant = '', kicker = '') {
    this.bannerKicker.textContent = kicker;
    this.bannerTitle.textContent = title;
    this.bannerSub.textContent = sub;
    this.banner.className = `banner ${variant}`;
    void this.banner.offsetWidth;
    this.banner.classList.add('visible');
  }

  hideBanner() {
    this.banner.classList.remove('visible');
  }

  flash(color) {
    this.flashEl.style.background = color;
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('on');
  }

  hurt() {
    this.vignette.classList.remove('on');
    void this.vignette.offsetWidth;
    this.vignette.classList.add('on');
  }
}
