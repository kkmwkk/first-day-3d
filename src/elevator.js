import * as THREE from 'three';
import { blockMesh, canvasPlane, font, hitBox, makeCollider } from './builder.js';
import { FH, CAR, DOOR, CORE_FRONT } from './layout.js';

const DOOR_TIME = 1.1;
const PANEL = 0.7; // 문짝 하나의 폭
const CX = (DOOR.x0 + DOOR.x1) / 2;

const drawDisplay = (text) => (g, w, h) => {
  g.fillStyle = '#0b0d12';
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#ff9a3d';
  g.font = font(h * 0.7, 800);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + h * 0.04);
};

const drawButton = (label, state) => (g, w) => {
  g.fillStyle = state === 'lit' ? '#ff8a2a' : state === 'deny' ? '#e5484d' : '#20242c';
  g.beginPath();
  g.arc(w / 2, w / 2, w * 0.44, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = w * 0.06;
  g.strokeStyle = state === 'idle' ? '#9aa4b2' : '#ffffff';
  g.stroke();
  g.fillStyle = '#fff';
  g.font = font(w * 0.44, 800);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(label, w / 2, w / 2 + w * 0.03);
};

export class Elevator {
  // hooks: onDoorsOpen(floor), onArrive(floor), onButton(n), onCall(floor)
  constructor({ scene, M, colliders, cfg, hooks }) {
    this.cfg = cfg;
    this.hooks = hooks;
    this.served = [1, cfg.myFloor];
    this.floor = 1;
    this.target = 1;
    this.y = 0;
    this.state = 'closed'; // closed | calling | opening | open | closing | moving
    this.door = 0; // 0 닫힘 ~ 1 열림
    this.t = 0;
    this.called = false;
    this.interactables = [];
    this.carColliders = [];
    this.displays = [];
    this.displayText = '';
    this.buttons = new Map();
    this.denyTimers = new Map();

    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildCar(M, colliders);
    this.landings = new Map();
    for (const f of this.served) this.landings.set(f, this.buildLanding(scene, M, colliders, f));
    this.apply();
  }

  carBox(colliders, x0, y0, z0, x1, y1, z1) {
    const c = makeCollider(x0, y0, z0, x1, y1, z1);
    c.baseMin = c.min.y;
    c.baseMax = c.max.y;
    colliders.push(c);
    this.carColliders.push(c);
    return c;
  }

  buildCar(M, colliders) {
    const { x0, x1, z0, z1, h } = CAR;
    const add = (mat, ax, ay, az, bx, by, bz, solid = true) => {
      const m = blockMesh(mat, bx - ax, by - ay, bz - az);
      m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
      this.group.add(m);
      if (solid) this.carBox(colliders, ax, ay, az, bx, by, bz);
      return m;
    };

    // 바닥은 건물 바닥과 높이를 맞추고, 겹쳐 보이지 않게 그림만 1cm 올린다.
    add(M.stoneDark, x0, -0.2, z0, x1, 0.01, z1, false);
    this.carBox(colliders, x0, -0.2, z0, x1, 0, z1);
    add(M.steel, x0, 0, z0, x0 + 0.1, h, z1);
    add(M.steel, x1 - 0.1, 0, z0, x1, h, z1);
    add(M.wood, x0, 0, z0, x1, h, z0 + 0.1);
    add(M.steel, x0, 0, z1 - 0.1, DOOR.x0, h, z1);
    add(M.steel, DOOR.x1, 0, z1 - 0.1, x1, h, z1);
    add(M.steel, DOOR.x0, DOOR.h, z1 - 0.1, DOOR.x1, h, z1);
    add(M.white, x0, h, z0, x1, h + 0.1, z1);
    add(M.glow, x0 + 0.5, h - 0.02, z0 + 0.5, x1 - 0.5, h, z1 - 0.6, false);
    add(M.darkMetal, x0 + 0.1, 0.9, z0 + 0.3, x0 + 0.16, 0.96, z1 - 0.5, false);
    add(M.darkMetal, x0 + 0.3, 0.9, z0 + 0.1, x1 - 0.3, 0.96, z0 + 0.16, false);

    // 카 문
    const dz = z1 - 0.055;
    this.carDoors = [-1, 1].map((side) => {
      const m = blockMesh(M.steelDoor, PANEL, DOOR.h, 0.05);
      m.position.set(CX + (side * PANEL) / 2, DOOR.h / 2, dz);
      m.userData.side = side;
      this.group.add(m);
      return m;
    });
    this.carDoorCollider = this.carBox(colliders, DOOR.x0, 0, z1 - 0.08, DOOR.x1, DOOR.h, z1 - 0.03);

    // 층 버튼 패널 (오른쪽 벽, 문 가까이)
    const N = this.cfg.totalFloors;
    const cols = N > 12 ? 3 : 2;
    const rows = Math.ceil(N / cols);
    const px = x1 - 0.1;
    const pz = z1 - 0.65;
    const py = 1.35;
    const ph = rows * 0.19 + 0.16;
    add(M.darkMetal, px - 0.02, py - ph / 2, pz - cols * 0.1 - 0.06, px, py + ph / 2, pz + cols * 0.1 + 0.06, false);
    for (let n = 1; n <= N; n++) {
      const row = Math.floor((n - 1) / cols);
      const col = (n - 1) % cols;
      const btn = canvasPlane(0.15, 0.15, drawButton(String(n), 'idle'), { ppm: 640, transparent: true });
      btn.mesh.position.set(px - 0.025, py - ph / 2 + 0.17 + row * 0.19, pz + (col - (cols - 1) / 2) * 0.2);
      btn.mesh.rotation.y = -Math.PI / 2;
      this.group.add(btn.mesh);
      this.buttons.set(n, { ...btn, state: 'idle' });
      this.interactables.push({
        object: btn.mesh,
        prompt: () => `${n}층 누르기`,
        act: () => this.hooks.onButton?.(n),
      });
    }

    // 카 안 층 표시
    const disp = canvasPlane(0.5, 0.2, drawDisplay('1'), { ppm: 400 });
    disp.mesh.position.set(CX, DOOR.h + 0.15, z1 - 0.105);
    disp.mesh.rotation.y = Math.PI;
    this.group.add(disp.mesh);
    this.displays.push(disp);
  }

  buildLanding(scene, M, colliders, floor) {
    const y0 = (floor - 1) * FH;
    const doors = [-1, 1].map((side) => {
      const m = blockMesh(M.steelDoor, PANEL, DOOR.h, 0.08);
      m.position.set(CX + (side * PANEL) / 2, y0 + DOOR.h / 2, CORE_FRONT - 0.2);
      m.userData.side = side;
      scene.add(m);
      return m;
    });
    const collider = makeCollider(DOOR.x0, y0, CORE_FRONT - 0.25, DOOR.x1, y0 + DOOR.h, CORE_FRONT - 0.15);
    colliders.push(collider);

    const disp = canvasPlane(0.5, 0.24, drawDisplay('1'), { ppm: 400 });
    disp.mesh.position.set(CX, y0 + DOOR.h + 0.32, CORE_FRONT + 0.012);
    scene.add(disp.mesh);
    this.displays.push(disp);

    const bx = DOOR.x1 + 0.34;
    const plate = blockMesh(M.steel, 0.14, 0.26, 0.02);
    plate.position.set(bx, y0 + 1.2, CORE_FRONT + 0.01);
    scene.add(plate);
    const call = canvasPlane(0.09, 0.09, drawButton('▲', 'idle'), { ppm: 800, transparent: true });
    call.mesh.position.set(bx, y0 + 1.2, CORE_FRONT + 0.022);
    scene.add(call.mesh);
    const hit = hitBox(0.36, 0.5, 0.12);
    hit.position.set(bx, y0 + 1.2, CORE_FRONT + 0.03);
    scene.add(hit);
    this.interactables.push({
      object: hit,
      prompt: () => (this.state === 'closed' && this.floor === floor ? '엘리베이터 호출' : null),
      act: () => this.hooks.onCall?.(floor),
    });
    return { doors, collider, call, floor };
  }

  setButton(n, state) {
    const b = this.buttons.get(n);
    if (!b || b.state === state) return;
    b.state = state;
    b.redraw(drawButton(String(n), state));
  }

  // 플레이어가 카 안에 있는지 (닫힌 문에 바짝 붙어 선 경우까지 포함)
  contains(p) {
    return p.x > CAR.x0 && p.x < CAR.x1 && p.z > CAR.z0 && p.z < CAR.z1 - 0.2 && Math.abs(p.y - this.y) < 1;
  }

  // 문이 닫혀도 끼지 않을 만큼 충분히 안쪽에 있는지 (층 버튼을 누를 수 있는 조건)
  isInside(p) {
    return this.contains(p) && p.z < CAR.z1 - 0.42;
  }

  isRiding(p) {
    return (this.state === 'moving' || this.state === 'closing') && this.contains(p);
  }

  call(floor) {
    if (this.state !== 'closed') return this.state === 'open' || this.state === 'opening' ? 'already' : 'busy';
    if (floor !== this.floor) {
      this.target = floor;
      this.state = 'closing';
      return 'coming';
    }
    if (!this.called) {
      this.called = true;
      this.state = 'calling';
      this.t = 0;
    } else {
      this.state = 'opening';
    }
    return 'ok';
  }

  press(n, inside) {
    if (this.state === 'moving' || this.state === 'closing' || this.state === 'calling') return 'busy';
    if (!inside) return 'outside';
    if (n === this.floor) {
      if (this.state === 'closed') this.state = 'opening';
      return 'same';
    }
    if (!this.served.includes(n)) {
      this.setButton(n, 'deny');
      this.denyTimers.set(n, 0.9);
      return 'denied';
    }
    this.target = n;
    this.state = 'closing';
    this.setButton(n, 'lit');
    return 'go';
  }

  update(dt) {
    for (const [n, left] of this.denyTimers) {
      if (left - dt <= 0) {
        this.denyTimers.delete(n);
        this.setButton(n, 'idle');
      } else this.denyTimers.set(n, left - dt);
    }

    switch (this.state) {
      case 'calling':
        this.t += dt;
        if (this.t >= 1.8) this.state = 'opening';
        break;
      case 'opening':
        this.door = Math.min(1, this.door + dt / DOOR_TIME);
        if (this.door >= 1) {
          this.state = 'open';
          this.hooks.onDoorsOpen?.(this.floor);
        }
        break;
      case 'closing':
        this.door = Math.max(0, this.door - dt / DOOR_TIME);
        if (this.door <= 0) {
          this.state = 'moving';
          this.t = 0;
          this.fromY = this.y;
          this.toY = (this.target - 1) * FH;
          this.dur = Math.max(3, Math.abs(this.target - this.floor) * 1.1);
        }
        break;
      case 'moving': {
        this.t += dt;
        const p = Math.min(1, this.t / this.dur);
        const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
        this.y = this.fromY + (this.toY - this.fromY) * e;
        if (p >= 1) {
          this.y = this.toY;
          this.floor = this.target;
          this.setButton(this.floor, 'idle');
          this.state = 'opening';
          this.hooks.onArrive?.(this.floor);
        }
        break;
      }
      default:
    }
    this.apply();
  }

  currentText() {
    if (this.state === 'calling') {
      const from = Math.min(3, this.cfg.totalFloors);
      const shown = Math.max(1, from - Math.floor(this.t / 0.6));
      return shown > 1 ? `▼ ${shown}` : '1';
    }
    if (this.state === 'moving') {
      const now = Math.round(this.y / FH) + 1;
      return `${this.toY > this.fromY ? '▲' : '▼'} ${now}`;
    }
    return String(this.floor);
  }

  apply() {
    this.group.position.y = this.y;
    for (const c of this.carColliders) {
      c.min.y = c.baseMin + this.y;
      c.max.y = c.baseMax + this.y;
    }
    const shift = PANEL * this.door;
    // 문이 닫히기 시작하면 바로 막아서, 출발 직전에 문틈으로 빠져나가 통로에 갇히는 일을 없앤다.
    const passable = this.door > 0.85 && this.state !== 'closing' && this.state !== 'moving';
    for (const m of this.carDoors) m.position.x = CX + m.userData.side * (PANEL / 2 + shift);
    this.carDoorCollider.active = !passable;
    const parked = this.state !== 'moving';
    for (const [floor, l] of this.landings) {
      const here = parked && floor === this.floor;
      const s = here ? shift : 0;
      for (const m of l.doors) m.position.x = CX + m.userData.side * (PANEL / 2 + s);
      l.collider.active = !(here && passable);
    }
    const text = this.currentText();
    if (text !== this.displayText) {
      this.displayText = text;
      for (const d of this.displays) d.redraw(drawDisplay(text));
    }
  }
}
