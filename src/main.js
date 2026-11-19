import * as THREE from 'three';
import { resolveConfig } from './config.js';
import { createMaterials } from './textures.js';
import { buildWorld } from './world.js';
import { Player } from './player.js';
import { Elevator } from './elevator.js';
import { Confetti } from './confetti.js';
import { Hud } from './hud.js';
import { HALF_W, LOBBY_FRONT, BACK } from './layout.js';

const cfg = resolveConfig();
const F = cfg.myFloor;
const SKY = 0x9fd0f5;

// ── 화면 ──
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 90, 320);
const camera = new THREE.PerspectiveCamera(72, 1, 0.05, 500);
scene.add(new THREE.HemisphereLight(0xffffff, 0xa9b4c2, 2.4));
const sun = new THREE.DirectionalLight(0xfff3dc, 1.6);
sun.position.set(50, 90, 70);
scene.add(sun);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ── 월드 ──
const M = createMaterials();
const world = buildWorld(scene, M, cfg);
const player = new Player(camera, world.colliders);
player.pitch = 0.12;
const hud = new Hud(cfg);
const confetti = new Confetti(scene);

// ── 진행 단계 ──
const STEPS = [
  { id: 'enter', text: '사옥 정문으로 들어가세요' },
  { id: 'badge', text: '안내 데스크에서 사원증을 받으세요' },
  { id: 'gate', text: '출입 게이트에 사원증을 태깅하세요' },
  { id: 'call', text: '엘리베이터를 호출하세요' },
  { id: 'ride', text: `엘리베이터에 타서 ${F}층 버튼을 누르세요` },
  { id: 'seat', text: `내 자리를 찾아가세요 (명패: ${cfg.name})` },
];
const DONE_TEXT = '첫 출근 완료! 자유롭게 둘러보세요';
const state = { step: 0, hasBadge: false, giftOpened: false, done: false };

function showObjective() {
  const s = STEPS[state.step];
  hud.setObjective(s ? s.text : DONE_TEXT, state.step, STEPS.length);
}

// 해당 단계를 끝낸 것으로 처리한다. 순서를 건너뛰어도 뒤로 돌아가지 않는다.
function reach(id) {
  const i = STEPS.findIndex((s) => s.id === id);
  if (i < state.step) return;
  state.step = i + 1;
  showObjective();
}
showObjective();

// ── 엘리베이터 ──
const elevator = new Elevator({
  scene,
  M,
  colliders: world.colliders,
  cfg,
  hooks: {
    onCall(floor) {
      if (elevator.call(floor) === 'ok' && elevator.state === 'calling') hud.toast('엘리베이터가 내려오고 있습니다');
    },
    onButton(n) {
      const r = elevator.press(n, elevator.isInside(player.pos));
      if (r === 'outside') hud.toast('엘리베이터에 탄 다음 눌러 주세요');
      else if (r === 'same') hud.toast('지금 있는 층입니다');
      else if (r === 'denied') hud.toast(`${n}층은 출입 권한이 없습니다. 내 조직은 ${F}층입니다`);
      else if (r === 'go') hud.toast(n === 1 ? '1층으로 내려갑니다' : `${n}층으로 올라갑니다`);
    },
    onDoorsOpen(floor) {
      if (floor === 1) reach('call');
    },
    onArrive(floor) {
      if (floor === F) {
        hud.toast(`${F}층입니다 · ${cfg.org}`);
        if (elevator.contains(player.pos)) reach('ride');
      } else {
        hud.toast('1층 로비입니다');
      }
    },
  },
});

// ── 상호작용 ──
const interactables = [
  {
    object: world.badgeHit,
    prompt: () => (state.hasBadge ? null : '사원증 받기'),
    act() {
      state.hasBadge = true;
      scene.remove(world.badge);
      hud.showBadge();
      hud.toast(`사원증을 받았습니다 · ${cfg.name}`);
      reach('badge');
    },
  },
  ...world.padHits.map((object) => ({
    object,
    prompt: () => (world.gate.open ? null : '사원증 태깅'),
    act() {
      if (!state.hasBadge) {
        hud.toast('사원증이 필요합니다. 안내 데스크에서 받아 오세요');
        return;
      }
      world.gate.open = true;
      world.gate.collider.active = false;
      world.gate.pads.forEach((p) => p.material.color.setHex(0x3ddc84));
      hud.toast(`인증되었습니다. 환영합니다, ${cfg.name} 님`);
      reach('gate');
    },
  })),
  {
    object: world.giftHit,
    prompt: () => (state.giftOpened ? null : '웰컴 키트 열기'),
    act() {
      state.giftOpened = true;
      hud.toast('웰컴 키트: 머그컵, 노트, 스티커가 들어 있습니다', 4500);
    },
  },
  ...elevator.interactables,
];
const targets = interactables.map((i) => i.object);
const byObject = new Map(interactables.map((i) => [i.object, i]));
const ray = new THREE.Raycaster();
ray.far = 3.2;
const CENTER = new THREE.Vector2(0, 0);
let focused = null;

function updateFocus() {
  focused = null;
  if (running) {
    ray.setFromCamera(CENTER, camera);
    for (const h of ray.intersectObjects(targets, false)) {
      const it = byObject.get(h.object);
      const label = it.prompt();
      if (label) {
        focused = it;
        hud.setPrompt(label);
        break;
      }
    }
  }
  if (!focused) hud.setPrompt(null);
}

function interact() {
  if (running && focused) focused.act();
}

// ── 입력 ──
let running = false;
let dragMode = new URLSearchParams(window.location.search).has('drag');
let dragging = false;
const keys = new Set();
const LOOK = 0.0022;

function setRunning(v) {
  if (running === v) return;
  running = v;
  keys.clear();
  hud.setOverlay(!v, true);
}

function start(forceDrag) {
  if (forceDrag) dragMode = true;
  if (dragMode) {
    if (document.pointerLockElement) document.exitPointerLock();
    setRunning(true);
    return;
  }
  const p = canvas.requestPointerLock();
  if (p && p.catch) {
    p.catch((err) => {
      console.warn('마우스 고정 실패:', err?.message ?? err);
      if (everLocked) {
        // 브라우저는 Esc 직후 잠깐 동안 마우스 고정을 거절한다.
        document.getElementById('start').textContent = '한 번 더 클릭해 주세요';
      } else {
        // 마우스 고정을 아예 허용하지 않는 환경이면 드래그 모드로 넘어간다.
        start(true);
        hud.toast('드래그 모드: 마우스를 누른 채 움직이거나 방향키로 시점을 돌리세요', 6000);
      }
    });
  }
}

let everLocked = false;
document.getElementById('start').addEventListener('click', () => start(false));
document.getElementById('start-drag').addEventListener('click', () => start(true));
document.addEventListener('pointerlockchange', () => {
  if (dragMode) return;
  const locked = document.pointerLockElement === canvas;
  if (locked) everLocked = true;
  setRunning(locked);
});

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (dragMode && e.code === 'Escape') setRunning(false);
  if (!running) return;
  keys.add(e.code);
  if (e.code === 'KeyE' && !e.repeat) interact();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

canvas.addEventListener('mousedown', (e) => {
  if (!running || e.button !== 0) return;
  if (dragMode) dragging = true;
  else interact();
});
window.addEventListener('mouseup', () => {
  dragging = false;
});
document.addEventListener('mousemove', (e) => {
  if (!running) return;
  if (document.pointerLockElement !== canvas && !(dragMode && dragging)) return;
  player.yaw -= e.movementX * LOOK;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch - e.movementY * LOOK));
});

const held = (code) => (keys.has(code) ? 1 : 0);
function readInput(dt) {
  // 방향키로도 시점을 돌릴 수 있다.
  player.yaw += (held('ArrowLeft') - held('ArrowRight')) * 2.2 * dt;
  player.pitch = Math.max(-1.5, Math.min(1.5, player.pitch + (held('ArrowUp') - held('ArrowDown')) * 1.6 * dt));
  return {
    f: held('KeyW') - held('KeyS'),
    r: held('KeyD') - held('KeyA'),
    jump: keys.has('Space'),
    sprint: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

// ── 매 프레임 ──
const SUBSTEP = 1 / 30;
let time = 0;

function celebrate() {
  state.done = true;
  scene.remove(world.beacon);
  confetti.burst(new THREE.Vector3(world.seat.x, world.yF + 1.9, world.seat.z - 0.5), world.yF);
  hud.showWelcome();
  reach('seat');
}

function locationText(p) {
  if (elevator.state === 'moving' && elevator.contains(p)) return `엘리베이터 ${elevator.displayText}F`;
  if (p.y > world.yF - 1) return `${F}F · ${cfg.org}`;
  const indoors = Math.abs(p.x) < HALF_W && p.z < LOBBY_FRONT && p.z > BACK;
  return indoors ? '1F 로비' : '사옥 앞 광장';
}

function logic(dt) {
  const p = player.pos;

  if (state.step === 0 && p.z < LOBBY_FRONT - 0.6 && Math.abs(p.x) < HALF_W) reach('enter');

  // 정문 자동문
  const e = world.entrance;
  const near = p.y < 3 && Math.hypot(p.x, p.z - LOBBY_FRONT) < 5;
  e.frac = Math.max(0, Math.min(1, e.frac + (near ? 1 : -1) * dt * 2.5));
  e.left.position.x = -0.75 - 1.45 * e.frac;
  e.right.position.x = 0.75 + 1.45 * e.frac;
  e.collider.active = e.frac < 0.6;

  // 출입 게이트 날개
  const g = world.gate;
  if (g.open && g.frac < 1) {
    g.frac = Math.min(1, g.frac + dt / 0.4);
    const k = 1 - (1 - g.frac) ** 2;
    for (const f of g.flaps) f.pivot.rotation.y = f.openAngle * k;
  }

  if (!state.done && p.y > world.yF - 0.5 && Math.hypot(p.x - world.seat.x, p.z - world.seat.z) < 1.5) celebrate();

  hud.setLocation(locationText(p));
}

function ambient(dt) {
  for (const c of world.clouds.children) {
    c.position.x += 1.2 * dt;
    if (c.position.x > 180) c.position.x -= 360;
  }
  if (!state.hasBadge) {
    world.badge.rotation.y += dt * 1.4;
    world.badge.position.y = 1.65 + Math.sin(time * 2.2) * 0.05;
  }
  if (!state.done) world.beacon.material.opacity = 0.28 + Math.sin(time * 3) * 0.1;
  for (const bl of world.balloons) bl.group.position.y = bl.baseY + Math.sin(time * 1.3 + bl.phase) * 0.05;
  confetti.update(dt);
}

let last = performance.now();
function frame(now) {
  // 프레임이 느려도 걷는 속도가 줄지 않도록, 긴 프레임은 잘게 나눠 계산한다.
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  time += dt;
  if (running && dt > 0) {
    const n = Math.ceil(dt / SUBSTEP);
    for (let i = 0; i < n; i++) step(dt / n);
  }
  ambient(dt);
  player.syncCamera();
  renderer.render(scene, camera);
  updateFocus();
  requestAnimationFrame(frame);
}

function step(dt) {
  elevator.update(dt);
  player.lockY = elevator.isRiding(player.pos) ? elevator.y : null;
  player.update(dt, readInput(dt));
  logic(dt);
}

requestAnimationFrame(frame);

// 콘솔에서 상태를 확인하거나 위치를 옮겨 볼 때 쓰는 손잡이
window.__game = {
  cfg,
  state,
  player,
  elevator,
  world,
  renderer,
  scene,
  confetti,
  celebrate,
  interact,
  step,
  get focused() {
    return focused ? focused.prompt() : null;
  },
  teleport(x, y, z, yaw = player.yaw, pitch = player.pitch) {
    player.pos.set(x, y, z);
    player.vel.set(0, 0, 0);
    player.yaw = yaw;
    player.pitch = pitch;
  },
};
