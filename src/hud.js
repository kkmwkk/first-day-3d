const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(cfg) {
    this.toastTimer = 0;
    this.welcomeTimer = 0;
    this.promptText = null;
    this.locText = '';
    $('ov-eyebrow').textContent = `${cfg.company} · 과천`;
    $('bc-company').textContent = cfg.company;
    $('bc-name').textContent = cfg.name;
    $('bc-org').textContent = cfg.org;
    $('w-name').textContent = `${cfg.name} 님, 입사를 축하합니다`;
    $('w-org').textContent = `${cfg.company} · ${cfg.org} · ${cfg.myFloor}F`;
  }

  // 시작 화면과 일시정지 화면을 겸한다.
  setOverlay(visible, paused = false) {
    $('overlay').classList.toggle('hidden', !visible);
    $('hud').classList.toggle('hidden', visible);
    if (paused) {
      $('ov-title').textContent = '일시정지';
      $('start').textContent = '클릭해서 계속';
    }
  }

  setObjective(text, index, total) {
    $('obj-text').textContent = text;
    $('obj-step').textContent = index < total ? `${index + 1} / ${total}` : '완료';
  }

  setLocation(text) {
    if (text === this.locText) return;
    this.locText = text;
    $('location').textContent = text;
  }

  setPrompt(text) {
    if (text === this.promptText) return;
    this.promptText = text;
    $('prompt').classList.toggle('hidden', !text);
    if (text) $('prompt-text').textContent = text;
  }

  toast(message, ms = 3200) {
    const el = $('toast');
    el.textContent = message;
    el.classList.remove('hidden');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }

  showBadge() {
    $('badge-card').classList.remove('hidden');
  }

  showWelcome(ms = 9000) {
    const el = $('welcome');
    el.classList.remove('hidden');
    clearTimeout(this.welcomeTimer);
    this.welcomeTimer = setTimeout(() => el.classList.add('hidden'), ms);
  }
}
