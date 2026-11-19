const $ = (id) => document.getElementById(id);

export class Hud {
  constructor(cfg) {
    this.timers = {};
    this.promptText = null;
    this.locText = '';
    $('ov-eyebrow').textContent = `${cfg.company} · 과천`;
    $('bc-company').textContent = cfg.company;
    $('bc-name').textContent = cfg.name;
    $('bc-org').textContent = cfg.org;
  }

  // 잠깐 보였다가 사라지는 요소
  flash(id, ms) {
    const el = $(id);
    el.classList.remove('hidden');
    clearTimeout(this.timers[id]);
    this.timers[id] = setTimeout(() => el.classList.add('hidden'), ms);
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

  setObjective(text, label) {
    $('obj-text').textContent = text;
    $('obj-label').textContent = label;
  }

  // items: [{ text, done, locked }]
  setMissions(items) {
    const list = $('mis-list');
    list.replaceChildren(
      ...items.map((it) => {
        const li = document.createElement('li');
        li.textContent = it.text;
        if (it.done) li.className = 'done';
        else if (it.locked) li.className = 'locked';
        return li;
      }),
    );
    $('missions').classList.remove('hidden');
  }

  setInventory(names) {
    $('inventory').replaceChildren(
      ...names.map((name) => {
        const chip = document.createElement('span');
        chip.textContent = name;
        return chip;
      }),
    );
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
    $('toast').textContent = message;
    this.flash('toast', ms);
  }

  showDialog(name, text, ms = 4200) {
    $('dlg-name').textContent = name;
    $('dlg-text').textContent = text;
    this.flash('dialog', ms);
  }

  showBadge() {
    $('badge-card').classList.remove('hidden');
  }

  showCard(title, line1, line2, ms = 9000) {
    $('card-title').textContent = title;
    $('card-line1').textContent = line1;
    $('card-line2').textContent = line2;
    this.flash('welcome', ms);
  }

  showNote(imageUrl, note) {
    $('note-img').src = imageUrl;
    $('note-to').textContent = note.to ? `${note.to}에게` : '';
    $('note-lines').replaceChildren(
      ...note.lines.map((line) => {
        const p = document.createElement('p');
        p.textContent = line;
        return p;
      }),
    );
    $('note-from').textContent = note.from ? `- ${note.from}` : '';
    $('note').classList.remove('hidden');
  }

  hideNote() {
    $('note').classList.add('hidden');
  }
}
