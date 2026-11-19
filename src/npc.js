import * as THREE from 'three';
import { canvasPlane, hitBox, font } from './builder.js';

const mats = new Map();
function mat(hex) {
  if (!mats.has(hex)) mats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  return mats.get(hex);
}
const part = (w, h, d, hex) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(hex));
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

// 8x8 픽셀 얼굴
function faceMaterial(look) {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const g = c.getContext('2d');
  g.fillStyle = css(look.skin);
  g.fillRect(0, 0, 8, 8);
  g.fillStyle = css(look.hair);
  g.fillRect(0, 0, 8, 2);
  if (look.long) {
    g.fillRect(0, 2, 1, 3);
    g.fillRect(7, 2, 1, 3);
  }
  g.fillStyle = '#20242c';
  g.fillRect(2, 4, 1, 1);
  g.fillRect(5, 4, 1, 1);
  g.fillStyle = '#b5524a';
  g.fillRect(3, 6, 2, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshLambertMaterial({ map: t });
}

// 블록 캐릭터. 원점은 발밑, 앞은 +z.
export function makeCharacter(look) {
  const g = new THREE.Group();
  const limb = (x, y, w, h, d, hex, handHex) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = part(w, h, d, hex);
    m.position.y = -h / 2;
    pivot.add(m);
    if (handHex !== undefined) {
      const hand = part(w, 0.14, d, handHex);
      hand.position.y = -h - 0.07;
      pivot.add(hand);
    }
    g.add(pivot);
    return pivot;
  };
  const legs = [limb(-0.115, 0.75, 0.2, 0.75, 0.22, look.pants), limb(0.115, 0.75, 0.2, 0.75, 0.22, look.pants)];
  const torso = part(0.46, 0.62, 0.26, look.shirt);
  torso.position.y = 1.06;
  g.add(torso);
  const arms = [limb(-0.31, 1.35, 0.16, 0.46, 0.18, look.shirt, look.skin), limb(0.31, 1.35, 0.16, 0.46, 0.18, look.shirt, look.skin)];

  const head = new THREE.Group();
  head.position.y = 1.39;
  const skull = part(0.42, 0.42, 0.42, look.skin);
  skull.position.y = 0.21;
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), faceMaterial(look));
  face.position.set(0, 0.21, 0.2105);
  const cap = part(0.46, 0.1, 0.46, look.hair);
  cap.position.y = 0.45;
  const backH = look.long ? 0.62 : 0.34;
  const back = part(0.46, backH, 0.08, look.hair);
  back.position.set(0, 0.44 - backH / 2, -0.23);
  head.add(skull, face, cap, back);
  if (look.long) {
    for (const s of [-1, 1]) {
      const side = part(0.06, 0.5, 0.3, look.hair);
      side.position.set(s * 0.23, 0.2, -0.06);
      head.add(side);
    }
  }
  g.add(head);
  g.userData.rig = { legs, arms, head };
  return g;
}

function makeTag(name) {
  const w = Math.max(0.5, name.length * 0.15 + 0.24);
  const { mesh } = canvasPlane(w, 0.22, (g, cw, ch) => {
    g.fillStyle = 'rgba(19, 26, 43, 0.85)';
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = '#fff';
    g.font = font(ch * 0.6, 700);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, cw / 2, ch / 2 + ch * 0.04, cw * 0.92);
  }, { ppm: 420, transparent: true });
  return mesh;
}

// 할 일이 있는 곳을 알려 주는 표식. kind: 'alert'(느낌표) | 'heart'
export function makeMarker(kind = 'alert') {
  const { mesh } = canvasPlane(0.34, 0.34, (g, w) => {
    if (kind === 'heart') {
      g.fillStyle = '#ff5d8f';
      const u = w / 9;
      [[1, 1, 3, 1], [5, 1, 3, 1], [0, 2, 9, 3], [1, 5, 7, 1], [2, 6, 5, 1], [3, 7, 3, 1], [4, 8, 1, 1]].forEach(([x, y, cw, ch]) =>
        g.fillRect(x * u, y * u, cw * u, ch * u),
      );
      return;
    }
    g.fillStyle = '#ffb02e';
    g.beginPath();
    g.moveTo(w / 2, w * 0.04);
    g.lineTo(w * 0.96, w / 2);
    g.lineTo(w / 2, w * 0.96);
    g.lineTo(w * 0.04, w / 2);
    g.closePath();
    g.fill();
    g.lineWidth = w * 0.06;
    g.strokeStyle = '#131a2b';
    g.stroke();
    g.fillStyle = '#131a2b';
    g.font = font(w * 0.6, 900);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', w / 2, w / 2 + w * 0.04);
  }, { ppm: 300, transparent: true });
  return mesh;
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turn = (from, to, t) => from + wrap(to - from) * Math.min(1, t);

// def: { id, name, look, pos:[x,y,z], yaw, mode:'stand'|'sit'|'walk', seatTop, path:[[x,z]...], loop, speed, talk(npc) }
export class Npc {
  constructor(scene, def) {
    this.def = def;
    this.id = def.id;
    this.name = def.name;
    this.pos = new THREE.Vector3(...def.pos);
    this.yaw = def.yaw ?? 0;
    this.homeYaw = this.yaw;
    this.mode = def.mode ?? 'stand';
    this.seatTop = def.seatTop ?? 0.5;
    this.path = def.path ?? null;
    this.pathIndex = 0;
    this.loop = def.loop ?? true;
    this.speed = def.speed ?? 1.3;
    this.yields = def.yields ?? true; // 플레이어가 가까이 오면 멈춰 선다
    this.onArrive = null;
    this.talkTimer = 0;
    this.count = 0; // 지금까지 한 말의 수 (대사를 돌려 가며 고르는 데 쓴다)
    this.phase = (def.pos[0] * 1.7 + def.pos[2]) % 6;
    this.showMarker = false;

    this.group = makeCharacter(def.look);
    this.rig = this.group.userData.rig;
    this.hit = hitBox(0.7, 1.9, 0.7);
    this.hit.position.y = 0.95;
    this.group.add(this.hit);
    scene.add(this.group);

    this.tag = makeTag(def.name);
    this.marker = makeMarker();
    this.tag.visible = false;
    this.marker.visible = false;
    scene.add(this.tag, this.marker);
    this.place(0);
  }

  // 정해진 길을 한 번 걸어간 뒤 그 자리에 선다.
  walkTo(path, { speed = 2.6, finalYaw = 0, onArrive = null } = {}) {
    this.mode = 'walk';
    this.path = path;
    this.pathIndex = 0;
    this.loop = false;
    this.speed = speed;
    this.yields = false;
    this.finalYaw = finalYaw;
    this.onArrive = onArrive;
  }

  place(swing) {
    const sitting = this.mode === 'sit';
    const y = sitting ? this.pos.y + this.seatTop + 0.1 - 0.75 : this.pos.y;
    this.group.position.set(this.pos.x, y, this.pos.z);
    this.group.rotation.y = this.yaw;
    const { legs, arms } = this.rig;
    legs[0].rotation.x = sitting ? -Math.PI / 2 : swing;
    legs[1].rotation.x = sitting ? -Math.PI / 2 : -swing;
    arms[0].rotation.x = sitting ? -0.9 : -swing * 0.8;
    arms[1].rotation.x = sitting ? -0.9 : swing * 0.8;
  }

  update(dt, time, player, camera) {
    const dx = player.x - this.pos.x;
    const dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const sameFloor = Math.abs(player.y - this.pos.y) < 2;
    const near = sameFloor && dist < 1.8;
    if (this.talkTimer > 0) this.talkTimer -= dt;

    let moving = false;
    let wantYaw = this.homeYaw;
    if (this.mode === 'walk' && this.path) {
      const paused = this.talkTimer > 0 || (this.yields && near);
      if (!paused) {
        const [tx, tz] = this.path[this.pathIndex];
        const vx = tx - this.pos.x;
        const vz = tz - this.pos.z;
        const d = Math.hypot(vx, vz);
        const stepLen = this.speed * dt;
        if (d <= stepLen) {
          this.pos.x = tx;
          this.pos.z = tz;
          this.pathIndex++;
          if (this.pathIndex >= this.path.length) {
            if (this.loop) this.pathIndex = 0;
            else {
              this.path = null;
              this.mode = 'stand';
              this.homeYaw = this.finalYaw ?? this.yaw;
              const done = this.onArrive;
              this.onArrive = null;
              if (done) done(this);
            }
          }
        } else {
          this.pos.x += (vx / d) * stepLen;
          this.pos.z += (vz / d) * stepLen;
          wantYaw = Math.atan2(vx, vz);
          this.homeYaw = wantYaw;
          moving = true;
        }
      }
    }

    // 가까이 온 플레이어를 바라본다. 앉아 있을 때는 고개만 돌린다.
    const watching = sameFloor && dist < 3.2;
    const toPlayer = Math.atan2(dx, dz);
    let headYaw = 0;
    if (this.mode === 'sit') {
      if (watching) headYaw = Math.max(-1.1, Math.min(1.1, wrap(toPlayer - this.yaw)));
    } else if (!moving && watching) {
      wantYaw = toPlayer;
    }
    if (this.mode !== 'sit') this.yaw = turn(this.yaw, wantYaw, 8 * dt);
    this.rig.head.rotation.y = turn(this.rig.head.rotation.y, headYaw, 8 * dt);
    this.place(moving ? Math.sin(time * 9 + this.phase) * 0.7 : 0);

    // 이름표와 표식은 항상 카메라를 향한다.
    const top = this.group.position.y + 2.02;
    this.tag.visible = sameFloor && dist < 7;
    this.tag.position.set(this.pos.x, top, this.pos.z);
    this.tag.quaternion.copy(camera.quaternion);
    this.marker.visible = this.showMarker;
    this.marker.position.set(this.pos.x, top + 0.38 + Math.sin(time * 3 + this.phase) * 0.05, this.pos.z);
    this.marker.quaternion.copy(camera.quaternion);
  }
}
