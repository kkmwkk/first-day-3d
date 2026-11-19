import * as THREE from 'three';
import { makeMarker } from './npc.js';
import { hitBox } from './builder.js';

const DURATION = 60; // 한 판 길이(초)
const ACTIVE = 3; // 동시에 떠 있는 장애 수
const LIFE = 14; // 이 시간 안에 못 고치면 놓친 것으로 친다
const FIX_TIME = 0.9; // 복구에 걸리는 시간
const REACH = 2.6; // 복구하는 동안 랙 앞에서 벗어나면 안 되는 거리
const GRADES = [[15, 'S'], [11, 'A'], [7, 'B'], [0, 'C']];
const BEST_KEY = 'first-day-3d.serverBest';

function loadBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // 저장이 막힌 환경에서는 이번 접속 동안만 기록이 유지된다.
  }
}

// 서버실 장애 대응 미니게임: 빨간 불이 켜진 랙을 찾아가 복구한다.
export function createServerGame({ scene, world, hud, player, onFinish }) {
  const y = world.yS;
  const racks = world.racks;
  const game = { state: 'idle', time: 0, countdown: 0, fixed: 0, missed: 0, best: loadBest(), plays: 0 };
  const recent = [];

  const slots = Array.from({ length: ACTIVE }, () => {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.2, 0.04), new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    const marker = makeMarker('fault');
    const hit = hitBox(0.8, 2.2, 0.5);
    hit.position.y = -100; // 장애가 생기기 전에는 닿지 않는 곳에 둔다
    for (const o of [lamp, bar, marker]) o.visible = false;
    scene.add(lamp, bar, marker, hit);
    return { rack: -1, life: 0, wait: 0, fixing: -1, flash: 0, lamp, bar, marker, hit };
  });

  function clear(s, wait) {
    s.rack = -1;
    s.wait = wait;
    s.fixing = -1;
    s.flash = 0;
    s.lamp.visible = false;
    s.bar.visible = false;
    s.marker.visible = false;
    s.hit.position.y = -100;
  }

  function spawn(s) {
    let pick = 0;
    for (let tries = 0; tries < 30; tries++) {
      pick = Math.floor(Math.random() * racks.length);
      if (!recent.includes(pick) && !slots.some((o) => o.rack === pick)) break;
    }
    recent.push(pick);
    if (recent.length > 8) recent.shift();
    const r = racks[pick];
    s.rack = pick;
    s.life = LIFE;
    s.fixing = -1;
    s.lamp.material.color.setHex(0xff3b3b);
    s.lamp.position.set(r.x, y + 1.55, r.z + 0.52);
    s.bar.position.set(r.x, y + 1.3, r.z + 0.52);
    s.marker.position.set(r.x, y + 2.78, r.z + 0.35);
    s.hit.position.set(r.x, y + 1.1, r.z + 0.75);
    s.lamp.visible = true;
    s.marker.visible = true;
  }

  function tick(s, dt, time) {
    if (s.flash > 0) {
      s.flash -= dt;
      if (s.flash <= 0) clear(s, 0.35);
      return;
    }
    if (s.rack < 0) {
      s.wait -= dt;
      if (s.wait <= 0) spawn(s);
      return;
    }
    const r = racks[s.rack];
    if (s.fixing >= 0) {
      const p = player.pos;
      const near = Math.abs(p.y - y) < 1 && Math.hypot(p.x - r.x, p.z - (r.z + 0.9)) < REACH;
      if (near) {
        s.fixing += dt;
        const k = Math.min(1, s.fixing / FIX_TIME);
        s.lamp.visible = true;
        s.lamp.material.color.setHex(0xffd23f);
        s.bar.visible = true;
        s.bar.scale.x = Math.max(0.001, k);
        s.bar.position.x = r.x - 0.28 * (1 - k);
        if (s.fixing >= FIX_TIME) {
          game.fixed++;
          s.fixing = -1;
          s.flash = 0.45;
          s.lamp.material.color.setHex(0x3ddc84);
          s.bar.visible = false;
          s.marker.visible = false;
          s.hit.position.y = -100;
        }
        return; // 복구하는 동안에는 남은 시간이 줄지 않는다
      }
      s.fixing = -1;
      s.bar.visible = false;
      s.lamp.material.color.setHex(0xff3b3b);
    }
    s.life -= dt;
    if (s.life <= 0) {
      game.missed++;
      clear(s, 0.6);
      return;
    }
    s.lamp.visible = Math.sin(time * (s.life < 5 ? 14 : 7)) > -0.2; // 시간이 얼마 안 남으면 빠르게 깜빡인다
    s.marker.position.y = y + 2.78 + Math.sin(time * 4) * 0.05;
  }

  function finish() {
    game.state = 'idle';
    for (const s of slots) clear(s, 0);
    hud.setRound(null);
    const grade = GRADES.find(([min]) => game.fixed >= min)[1];
    const isBest = game.fixed > game.best;
    if (isBest) {
      game.best = game.fixed;
      saveBest(game.best);
    }
    onFinish({ fixed: game.fixed, missed: game.missed, grade, best: game.best, isBest });
  }

  function start() {
    if (game.state !== 'idle') return false;
    game.plays++;
    game.fixed = 0;
    game.missed = 0;
    game.state = 'countdown';
    game.countdown = 3;
    return true;
  }

  function update(dt, time, camera) {
    if (game.state === 'countdown') {
      game.countdown -= dt;
      hud.setRound(`준비… ${Math.max(1, Math.ceil(game.countdown))}`);
      if (game.countdown <= 0) {
        game.state = 'playing';
        game.time = DURATION;
        slots.forEach((s, i) => clear(s, i * 0.25));
      }
    } else if (game.state === 'playing') {
      game.time -= dt;
      for (const s of slots) tick(s, dt, time);
      hud.setRound(`남은 시간 ${Math.max(0, Math.ceil(game.time))}초 · 복구 ${game.fixed}대 · 놓침 ${game.missed}대`);
      if (game.time <= 0) finish();
    }
    for (const s of slots) if (s.marker.visible) s.marker.quaternion.copy(camera.quaternion);
  }

  const interactables = slots.map((s) => ({
    object: s.hit,
    prompt: () => (game.state === 'playing' && s.rack >= 0 && s.fixing < 0 && s.flash <= 0 ? '서버 복구하기' : null),
    act() {
      s.fixing = 0;
    },
  }));

  return { game, slots, interactables, start, update };
}
