import * as THREE from 'three';
import { Builder, blockMesh, canvasPlane, textDraw, font, hitBox } from './builder.js';
import { makeRng } from './textures.js';
import { drawPhoto } from './photo.js';
import { FH, CEIL, HALF_W, BACK, LOBBY_FRONT, WING, SHAFT, DOOR, CORE_FRONT } from './layout.js';

const NS = { solid: false };
const FACE_BACK = Math.PI; // -z를 바라보는 판

export function buildWorld(scene, M, cfg) {
  const b = new Builder(scene);
  const H = cfg.totalFloors * FH;
  const yF = (cfg.myFloor - 1) * FH;

  ground(b, M);
  exterior(b, M, scene, cfg, H);
  const yS = (cfg.serverFloor - 1) * FH;
  const lobbyParts = lobby(b, M, scene, cfg);
  const officeParts = office(b, M, scene, cfg, yF);
  const serverParts = serverRoom(b, M, scene, cfg, yS);
  const cloudGroup = clouds(scene, M);
  b.finish();

  return { colliders: b.colliders, clouds: cloudGroup, yF, yS, ...lobbyParts, ...officeParts, ...serverParts };
}

function place(scene, mesh, x, y, z, rotY = 0) {
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  scene.add(mesh);
  return mesh;
}

function sign(scene, text, w, h, x, y, z, rotY = 0, opts = {}) {
  const { mesh } = canvasPlane(w, h, textDraw(text, opts), { ppm: opts.ppm ?? 160, transparent: !opts.bg });
  return place(scene, mesh, x, y, z, rotY);
}

// 구멍(엘리베이터 통로)이 뚫린 바닥판
function slabWithHole(b, mat, x0, y0, z0, x1, y1, z1, h) {
  b.box(mat, x0, y0, z0, h.x0, y1, z1);
  b.box(mat, h.x1, y0, z0, x1, y1, z1);
  b.box(mat, h.x0, y0, z0, h.x1, y1, h.z0);
  b.box(mat, h.x0, y0, h.z1, h.x1, y1, z1);
}

function tree(b, M, x, z) {
  b.box(M.trunk, x - 0.3, 0, z - 0.3, x + 0.3, 3, z + 0.3);
  b.box(M.leaf, x - 1.5, 3, z - 1.5, x + 1.5, 5.5, z + 1.5);
  b.box(M.leaf, x - 1, 5.5, z - 1, x + 1, 6.5, z + 1, NS);
}

function plant(b, M, x, y, z) {
  b.box(M.pot, x - 0.3, y, z - 0.3, x + 0.3, y + 0.5, z + 0.3);
  b.box(M.trunk, x - 0.05, y + 0.5, z - 0.05, x + 0.05, y + 0.9, z + 0.05, NS);
  b.box(M.leaf, x - 0.45, y + 0.9, z - 0.45, x + 0.45, y + 1.7, z + 0.45, NS);
  b.box(M.leaf, x - 0.25, y + 1.7, z - 0.25, x + 0.25, y + 2.1, z + 0.25, NS);
}

function chair(b, M, cx, y, cz, axis, dir) {
  b.box(M.black, cx - 0.05, y, cz - 0.05, cx + 0.05, y + 0.42, cz + 0.05, NS);
  b.box(M.chair, cx - 0.25, y + 0.42, cz - 0.25, cx + 0.25, y + 0.5, cz + 0.25, NS);
  if (axis === 'z') b.box(M.chair, cx - 0.25, y + 0.5, cz + dir * 0.2, cx + 0.25, y + 1.05, cz + dir * 0.27, NS);
  else b.box(M.chair, cx + dir * 0.2, y + 0.5, cz - 0.25, cx + dir * 0.27, y + 1.05, cz + 0.25, NS);
}

// ───────────────────────── 바깥 ─────────────────────────

function ground(b, M) {
  b.box(M.grass, -160, -1, -160, 160, -0.05, 160);

  // 보이지 않는 월드 경계
  b.collider(-66, -2, -51, -65, 80, 56);
  b.collider(65, -2, -51, 66, 80, 56);
  b.collider(-66, -2, -51, 66, 80, -50);
  b.collider(-66, -2, 55, 66, 80, 56);

  // 광장, 안마당, 도로
  b.box(M.pave, -34, -0.5, WING.z1, 34, 0, 36);
  b.box(M.pave, -HALF_W, -0.5, LOBBY_FRONT, HALF_W, 0, WING.z1);
  b.box(M.asphalt, -160, -0.5, 36, 160, 0, 47);
  b.box(M.pave, -160, -0.5, 47, 160, 0, 50);
  for (let x = -156; x < 156; x += 8) b.box(M.white, x, 0, 41.4, x + 4, 0.015, 41.6, NS);

  // 안마당의 타원형 잔디 (블록으로 쌓은 타원)
  const cz = 9.5;
  for (let zi = 5; zi < 14; zi++) {
    const t = (zi + 0.5 - cz) / 4.5;
    const hw = Math.round(10 * Math.sqrt(1 - t * t));
    b.box(M.grass, -hw, 0, zi, hw, 0.2, zi + 1);
  }
  // 잔디 둘레의 낮은 조명 기둥
  for (const [x, z] of [[-11.2, 9.5], [11.2, 9.5], [-8, 4.2], [8, 4.2], [-8, 14.8], [8, 14.8], [-3.5, 3.9], [3.5, 3.9], [-3.5, 15.1], [3.5, 15.1]]) {
    b.box(M.darkMetal, x - 0.15, 0, z - 0.15, x + 0.15, 0.55, z + 0.15);
    b.box(M.glow, x - 0.15, 0.55, z - 0.15, x + 0.15, 0.65, z + 0.15, NS);
  }

  for (const x of [-30, -22, -14, 14, 22, 30]) tree(b, M, x, 32);
  for (const [x, z] of [[-40, 20], [-42, 2], [-40, -18], [40, 20], [42, 2], [40, -18], [-24, 21], [24, 21]]) tree(b, M, x, z);

  // 뒤편의 산 (계단식 언덕)
  for (const [cx, cz2, n] of [[-55, -115, 5], [45, -125, 6], [120, -105, 4]]) {
    for (let i = 0; i < n; i++) {
      const half = 52 - i * 8;
      b.box(M.hill, cx - half, i * 7 - 1, cz2 - half * 0.6, cx + half, i * 7 + 6, cz2 + half * 0.6, NS);
    }
  }
}

function exterior(b, M, scene, cfg, H) {
  const N = cfg.totalFloors;
  const F = cfg.myFloor;
  const HR = H + 2 * FH; // 오른쪽 동은 두 층 더 높다

  // 양옆 동
  b.box(M.facade, -WING.x1, -0.5, BACK, -HALF_W, H, WING.z1);
  b.box(M.concrete, -WING.x1 - 0.3, H, BACK - 0.3, -HALF_W, H + 0.5, WING.z1 + 0.3);
  b.box(M.facade, HALF_W, -0.5, BACK, WING.x1, HR, WING.z1);
  b.box(M.concrete, HALF_W - 0.3, HR, BACK - 0.3, WING.x1 + 0.3, HR + 0.5, WING.z1 + 0.3);

  // 본동 뒷면과 앞면(2층 이상). 내 층만 안이 들여다보인다.
  b.box(M.facade, -HALF_W, -0.5, BACK - 0.3, HALF_W, H, BACK);
  let k = 2;
  while (k <= N) {
    if (k === F) {
      b.box(M.facadeClear, -HALF_W, (k - 1) * FH, -0.3, HALF_W, k * FH, 0);
      k++;
      continue;
    }
    let e = k;
    while (e + 1 <= N && e + 1 !== F) e++;
    b.box(M.facade, -HALF_W, (k - 1) * FH, -0.3, HALF_W, e * FH, 0);
    k = e + 1;
  }

  // 지붕, 물러나 앉은 옥상 층, 옥상 정원
  b.box(M.concrete, -HALF_W, H, BACK, HALF_W, H + 0.4, 0);
  b.box(M.facade, -12, H + 0.4, -22, 12, H + 3.6, -6);
  b.box(M.darkMetal, -12.6, H + 3.6, -22.6, 12.6, H + 3.9, -5.4);
  b.box(M.grass, -16, H + 0.4, -4.5, 16, H + 0.55, -1, NS);
  b.box(M.grass, -WING.x1 + 1.5, H + 0.5, -10, -HALF_W - 1.5, H + 0.65, 12, NS);

  // 1층 기둥과 띠, 정문 캐노피
  for (const x of [-17.4, -11.5, -5.5, 5.5, 11.5, 17.4]) b.box(M.concrete, x - 0.4, 0, -1.0, x + 0.4, CEIL, -0.2);
  b.box(M.darkMetal, -HALF_W, 3.6, -0.02, HALF_W, FH, 0.06, NS);
  b.box(M.darkMetal, -3.6, 2.95, LOBBY_FRONT, 3.6, 3.15, 1.6);
  b.box(M.darkMetal, -3.5, 0, 1.3, -3.3, 2.95, 1.5);
  b.box(M.darkMetal, 3.3, 0, 1.3, 3.5, 2.95, 1.5);
  b.box(M.navy, -2.5, 3.15, 1.3, 2.5, 3.75, 1.5, NS);
  sign(scene, cfg.company, 4.8, 0.5, 0, 3.45, 1.51, 0, { spacing: 0.06, size: 0.62 });

  // 건물 상단 간판, 광장 표지석
  sign(scene, cfg.company, 10.5, 1.5, (HALF_W + WING.x1) / 2, HR - 2.2, WING.z1 + 0.05, 0, { spacing: 0.06, ppm: 96 });
  b.box(M.navy, 5, 0, 21.4, 12, 1.5, 22);
  sign(scene, cfg.company, 6.4, 0.9, 8.5, 0.8, 22.01, 0, { spacing: 0.06, ppm: 110 });
}

function clouds(scene, M) {
  const group = new THREE.Group();
  const r = makeRng(77);
  for (let i = 0; i < 12; i++) {
    const w = 12 + r() * 14;
    const d = 7 + r() * 8;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 2, d), M.cloud);
    m.position.set(-160 + r() * 320, 55 + r() * 20, -150 + r() * 260);
    group.add(m);
    if (r() > 0.4) {
      const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 2, d * 0.6), M.cloud);
      top.position.set(m.position.x + 2, m.position.y + 2, m.position.z);
      group.add(top);
    }
  }
  scene.add(group);
  return group;
}

// ───────────────────────── 엘리베이터 코어 (층마다 같은 모양) ─────────────────────────

function core(b, M, scene, y, wallMat = M.wall) {
  const top = y + CEIL;
  b.box(M.stoneDark, -6, y, BACK, SHAFT.x0, top, CORE_FRONT);
  b.box(M.stoneDark, SHAFT.x1, y, BACK, 6, top, CORE_FRONT);
  b.box(M.stoneDark, SHAFT.x0, y, BACK, SHAFT.x1, top, SHAFT.z0);
  b.box(M.stoneDark, SHAFT.x0, y, SHAFT.z1, DOOR.x0, top, CORE_FRONT);
  b.box(M.stoneDark, DOOR.x1, y, SHAFT.z1, SHAFT.x1, top, CORE_FRONT);
  b.box(M.stoneDark, DOOR.x0, y + DOOR.h, SHAFT.z1, DOOR.x1, top, CORE_FRONT);

  const trim = (x0, x1) => {
    b.box(M.steel, x0 - 0.12, y, CORE_FRONT, x0, y + DOOR.h + 0.12, CORE_FRONT + 0.03, NS);
    b.box(M.steel, x1, y, CORE_FRONT, x1 + 0.12, y + DOOR.h + 0.12, CORE_FRONT + 0.03, NS);
    b.box(M.steel, x0, y + DOOR.h, CORE_FRONT, x1, y + DOOR.h + 0.12, CORE_FRONT + 0.03, NS);
  };
  trim(DOOR.x0, DOOR.x1);

  // 운행하지 않는 두 번째 엘리베이터
  b.box(M.steelDoor, 1.8, y, CORE_FRONT, 3.2, y + DOOR.h, CORE_FRONT + 0.02, NS);
  b.box(M.darkMetal, 2.49, y, CORE_FRONT + 0.02, 2.51, y + DOOR.h, CORE_FRONT + 0.025, NS);
  trim(1.8, 3.2);
  sign(scene, '점검 중', 0.8, 0.26, 2.5, y + 1.5, CORE_FRONT + 0.035, 0, { bg: '#f2b632', color: '#1b1b1b', size: 0.6 });

  // 코어 양옆의 뒷벽
  b.box(wallMat, -HALF_W, y, BACK, -6, top, BACK + 0.15);
  b.box(wallMat, 6, y, BACK, HALF_W, top, BACK + 0.15);
}

// ───────────────────────── 1층 로비 ─────────────────────────

function lobby(b, M, scene, cfg) {
  const N = cfg.totalFloors;
  const F = cfg.myFloor;

  b.box(M.marble, -HALF_W, -0.3, BACK, HALF_W, 0, LOBBY_FRONT);
  slabWithHole(b, M.ceiling, -HALF_W, CEIL, BACK, HALF_W, FH, 0, SHAFT);
  b.box(M.wall, -HALF_W, 0, BACK, -HALF_W + 0.15, CEIL, LOBBY_FRONT);
  b.box(M.wall, HALF_W - 0.15, 0, BACK, HALF_W, CEIL, LOBBY_FRONT);

  // 정면 유리벽과 자동문
  b.box(M.glass, -HALF_W, 0, LOBBY_FRONT - 0.15, -1.5, CEIL, LOBBY_FRONT);
  b.box(M.glass, 1.5, 0, LOBBY_FRONT - 0.15, HALF_W, CEIL, LOBBY_FRONT);
  b.box(M.glass, -1.5, 2.6, LOBBY_FRONT - 0.15, 1.5, CEIL, LOBBY_FRONT);
  const leaf = () => blockMesh(M.glass, 1.5, 2.6, 0.06);
  const entrance = {
    left: place(scene, leaf(), -0.75, 1.3, LOBBY_FRONT - 0.075),
    right: place(scene, leaf(), 0.75, 1.3, LOBBY_FRONT - 0.075),
    collider: b.collider(-1.5, 0, LOBBY_FRONT - 0.15, 1.5, 2.6, LOBBY_FRONT),
    frac: 0,
  };

  // 안내 데스크
  b.box(M.navy, -14.5, 0, -13, -6.5, CEIL, -12.6);
  sign(scene, cfg.company, 6.4, 0.8, -10.5, 2.5, -12.59, 0, { spacing: 0.06 });
  b.box(M.wood, -13, 0, -10.6, -8, 1.05, -9.6);
  b.box(M.white, -13.1, 1.05, -10.7, -7.9, 1.12, -9.5);
  b.box(M.white, -9.6, 1.12, -9.76, -8.4, 1.44, -9.72, NS);
  sign(scene, '사원증 수령', 1.2, 0.32, -9, 1.28, -9.715, 0, { bg: '#ffffff', color: '#1a284e', size: 0.55 });

  // 입구의 안내 표지
  b.box(M.darkMetal, -3.05, 0, -6.05, -2.95, 1.1, -5.95, NS);
  b.box(M.navy, -3.8, 1.1, -6.03, -2.2, 2.0, -5.97, NS);
  const guide = canvasPlane(1.5, 0.8, (g, w, h) => {
    g.fillStyle = '#1a284e';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ff9a3d';
    g.font = font(h * 0.2, 800);
    g.fillText('신규 입사자 안내', w / 2, h * 0.27);
    g.fillStyle = '#fff';
    g.font = font(h * 0.17, 700);
    g.fillText('← 안내 데스크에서', w / 2, h * 0.56);
    g.fillText('사원증을 받으세요', w / 2, h * 0.78);
  });
  place(scene, guide.mesh, -3, 1.55, -5.965);

  // 사원증 (받기 전까지 데스크 위에 떠 있다)
  const badge = new THREE.Group();
  const card = canvasPlane(0.3, 0.44, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a284e';
    g.fillRect(0, 0, w, h * 0.24);
    g.fillStyle = '#ff9a3d';
    g.fillRect(w * 0.3, h * 0.32, w * 0.4, h * 0.3);
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(h * 0.085, 800);
    g.fillText(cfg.company, w / 2, h * 0.13, w * 0.9);
    g.fillStyle = '#1a284e';
    g.font = font(h * 0.14, 800);
    g.fillText(cfg.name, w / 2, h * 0.76, w * 0.9);
    g.font = font(h * 0.07, 600);
    g.fillText(cfg.org, w / 2, h * 0.9, w * 0.9);
  }, { ppm: 600 });
  card.mesh.material.side = THREE.DoubleSide;
  badge.add(card.mesh);
  const badgeHit = hitBox(0.7, 0.8, 0.7);
  badge.add(badgeHit);
  badge.position.set(-10.5, 1.65, -10.1);
  scene.add(badge);

  // 라운지
  b.box(M.navy, 6, 0, -12.5, 15, 0.02, -5.5, NS);
  b.box(M.orange, 7.5, 0, -7.2, 11.5, 0.42, -6.2);
  b.box(M.orange, 7.5, 0.42, -6.45, 11.5, 0.9, -6.2);
  b.box(M.orange, 7.5, 0, -11.8, 11.5, 0.42, -10.8);
  b.box(M.orange, 7.5, 0.42, -11.8, 11.5, 0.9, -11.55);
  b.box(M.wood, 8.5, 0, -9.5, 10.5, 0.4, -8.5);
  b.box(M.chair, 12.6, 0, -9.5, 13.6, 0.42, -8.5);
  b.box(M.chair, 13.35, 0.42, -9.5, 13.6, 0.9, -8.5);
  for (const [x, z] of [[16.8, -4.2], [-16.8, -4.2], [16.8, -14], [-16.8, -14], [-16.8, -16.2], [16.8, -16.2], [16.8, -24.8], [-16.8, -24.8]]) plant(b, M, x, 0, z);

  // 출입 게이트
  b.box(M.glass, -HALF_W + 0.15, 0, -15.06, -3.4, CEIL, -15);
  b.box(M.glass, 3.4, 0, -15.06, HALF_W - 0.15, CEIL, -15);
  b.box(M.navy, -1.9, 2.65, -15.03, 1.9, 3.15, -14.97, NS);
  sign(scene, '사원증을 태깅하세요', 3.6, 0.4, 0, 2.9, -14.965, 0, { size: 0.62 });
  const bodies = [-3.2, -3.2 + 6.4 / 3, 3.2 - 6.4 / 3, 3.2];
  const pads = [];
  const padHits = [];
  for (const c of bodies) {
    b.box(M.steel, c - 0.2, 0, -15.9, c + 0.2, 1.0, -14.1);
    b.box(M.darkMetal, c - 0.2, 1.0, -15.9, c + 0.2, 1.03, -14.1, NS);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.04, 0.34), new THREE.MeshBasicMaterial({ color: 0x3aa0ff }));
    pads.push(place(scene, pad, c, 1.05, -14.4));
    padHits.push(place(scene, hitBox(0.5, 0.5, 0.7), c, 1.2, -14.4));
  }
  const flaps = [];
  for (let i = 0; i < 3; i++) {
    const xa = bodies[i] + 0.2;
    const xb = bodies[i + 1] - 0.2;
    const w = (xb - xa) / 2 - 0.02;
    for (const [hx, side] of [[xa, 1], [xb, -1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(hx, 0, -15);
      const m = blockMesh(M.flap, w, 0.9, 0.04);
      m.position.set((side * w) / 2, 0.6, 0);
      pivot.add(m);
      scene.add(pivot);
      flaps.push({ pivot, openAngle: (side * Math.PI) / 2 });
    }
  }
  const gate = { pads, flaps, collider: b.collider(-3.4, 0, -15.05, 3.4, CEIL, -14.95), open: false, frac: 0 };

  // IT 지원 창구 (게이트 안쪽 오른편)
  b.box(M.white, 10, 0, -21.2, 16, 1.0, -20.4);
  b.box(M.wood, 9.95, 1.0, -21.25, 16.05, 1.06, -20.35, NS);
  b.box(M.navy, 11.1, 2.7, -20.83, 14.9, 3.2, -20.77, NS);
  sign(scene, 'IT 지원', 3.4, 0.4, 13, 2.95, -20.765, 0, { size: 0.62 });
  for (let i = 0; i < 3; i++) b.box(M.darkMetal, 14.6, 1.06 + i * 0.04, -21.05, 15.1, 1.09 + i * 0.04, -20.7, NS);

  // 엘리베이터 홀
  core(b, M, scene, 0);
  const directory = canvasPlane(1.4, 1.9, (g, w, h) => {
    g.fillStyle = '#131a2b';
    g.fillRect(0, 0, w, h);
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.font = font(h * 0.07, 800);
    g.fillText('층별 안내', w / 2, h * 0.08);
    const top = h * 0.16;
    const rowH = (h * 0.8) / N;
    for (let i = 0; i < N; i++) {
      const fl = N - i;
      const y = top + i * rowH;
      const mine = fl === F;
      if (mine) {
        g.fillStyle = '#ff8a2a';
        g.fillRect(w * 0.04, y + rowH * 0.08, w * 0.92, rowH * 0.84);
      }
      g.fillStyle = mine ? '#131a2b' : '#c9d2e3';
      g.textAlign = 'left';
      g.font = font(Math.min(rowH * 0.5, h * 0.06), 800);
      g.fillText(`${fl}F`, w * 0.09, y + rowH / 2);
      g.font = font(Math.min(rowH * 0.38, h * 0.045), 700);
      const label = mine ? cfg.org : fl === 1 ? '로비 · 안내 데스크' : '오피스';
      g.fillText(label, w * 0.3, y + rowH / 2, w * 0.64);
    }
  }, { ppm: 300 });
  place(scene, directory.mesh, 0.3, 1.75, CORE_FRONT + 0.012);

  return { entrance, badge, badgeHit, gate, padHits };
}

// ───────────────────────── 서버실 (오후 업무) ─────────────────────────

function serverRoom(b, M, scene, cfg, y) {
  const top = y + CEIL;
  slabWithHole(b, M.serverFloor, -HALF_W, y - 0.3, BACK, HALF_W, y, -0.3, SHAFT);
  slabWithHole(b, M.stoneDark, -HALF_W, top, BACK, HALF_W, y + FH, -0.3, SHAFT);
  b.box(M.darkMetal, -HALF_W, y, BACK, -HALF_W + 0.15, top, -0.3);
  b.box(M.darkMetal, HALF_W - 0.15, y, BACK, HALF_W, top, -0.3);
  b.box(M.darkMetal, -HALF_W, y, -0.45, HALF_W, top, -0.3); // 창이 없는 앞벽
  core(b, M, scene, y, M.darkMetal);

  // 랙은 0.8m 간격으로 네 줄. 엘리베이터 앞은 가로지르는 통로로 비워 둔다.
  const rows = [-4, -8, -12, -16];
  const segments = [[-15.2, 13], [-0.8, 19]];
  const racks = [];
  for (const z of rows) {
    for (const [x0, n] of segments) {
      const x1 = x0 + n * 0.8;
      b.collider(x0, y, z - 0.5, x1, y + 2.2, z + 0.5);
      b.box(M.darkMetal, x0, y + 2.6, z - 0.2, x1, y + 2.68, z + 0.2, NS); // 케이블 트레이
      b.box(M.screen, x0, y, z + 0.56, x1, y + 0.012, z + 0.64, NS); // 바닥 안내선
      for (let i = 0; i < n; i++) racks.push({ x: x0 + i * 0.8 + 0.4, z });
    }
    b.box(M.glow, -15.2, top - 0.03, z + 1.85, 14.4, top, z + 2.15, NS); // 통로 조명
  }
  const rackMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.78, 2.2, 1),
    [M.rackSide, M.rackSide, M.rackSide, M.rackSide, M.rackFront, M.rackSide],
    racks.length,
  );
  const at = new THREE.Matrix4();
  racks.forEach((r, i) => rackMesh.setMatrixAt(i, at.makeTranslation(r.x, y + 1.1, r.z)));
  rackMesh.frustumCulled = false;
  scene.add(rackMesh);

  // 엘리베이터 홀: 안내판과 관제 책상
  b.box(M.glow, -15.2, top - 0.03, -19.35, 14.4, top, -19.05, NS);
  const board = canvasPlane(1.6, 1.5, (g, w, h) => {
    g.fillStyle = '#0b0d12';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#3ddc84';
    g.font = font(h * 0.38, 900);
    g.fillText(`${cfg.serverFloor}F`, w / 2, h * 0.3);
    g.fillStyle = '#fff';
    g.font = font(h * 0.15, 800);
    g.fillText('서버실', w / 2, h * 0.62);
    g.fillStyle = '#ff9a3d';
    g.font = font(h * 0.08, 700);
    g.fillText('관계자 외 출입 금지', w / 2, h * 0.84);
  }, { ppm: 260 });
  place(scene, board.mesh, 0.3, y + 1.85, CORE_FRONT + 0.012);
  b.box(M.darkMetal, 4.4, y, -21.45, 7.4, y + 0.95, -20.7);
  for (const mxn of [4.6, 5.55, 6.5]) {
    b.box(M.black, mxn, y + 0.95, -21.3, mxn + 0.8, y + 1.5, -21.24, NS);
    b.box(M.screen, mxn + 0.04, y + 0.99, -21.24, mxn + 0.76, y + 1.46, -21.234, NS);
  }

  return { racks };
}

// ───────────────────────── 내 조직 층 ─────────────────────────

function desk(b, M, x, y, zc, dir, { mine, rng }) {
  const z0 = dir > 0 ? zc : zc - 0.8;
  const z1 = z0 + 0.8;
  b.box(M.wood, x + 0.02, y + 0.72, z0, x + 1.58, y + 0.78, z1, NS);
  b.box(M.white, x + 0.04, y, z0 + 0.06, x + 0.1, y + 0.72, z1 - 0.06, NS);
  b.box(M.white, x + 1.5, y, z0 + 0.06, x + 1.56, y + 0.72, z1 - 0.06, NS);
  b.collider(x, y, z0, x + 1.6, y + 0.78, z1);

  const used = mine || rng() > 0.12;
  if (used) {
    const zm = zc + dir * 0.2;
    const zf = zm + dir * 0.025;
    b.box(M.black, x + 0.76, y + 0.78, zm - 0.04, x + 0.84, y + 0.92, zm + 0.04, NS);
    b.box(M.black, x + 0.5, y + 0.9, zm - 0.025, x + 1.1, y + 1.28, zm + 0.025, NS);
    if (!mine && rng() > 0.25) b.box(M.screen, x + 0.53, y + 0.93, zf, x + 1.07, y + 1.25, zf + dir * 0.006, NS);
    const zk = zc + dir * 0.52;
    // 내 자리는 나중에 노트북을 놓을 수 있게 키보드 자리를 비워 둔다.
    if (!mine) b.box(M.darkMetal, x + 0.55, y + 0.78, zk - 0.07, x + 1.05, y + 0.8, zk + 0.07, NS);
    if (!mine && rng() > 0.6) {
      const zp = zc + dir * 0.3;
      b.box(M.pot, x + 0.18, y + 0.78, zp - 0.07, x + 0.32, y + 0.9, zp + 0.07, NS);
      b.box(M.leaf, x + 0.14, y + 0.9, zp - 0.11, x + 0.36, y + 1.1, zp + 0.11, NS);
    }
  }
  chair(b, M, x + 0.8, y, zc + dir * 1.25, 'z', dir);
}

function office(b, M, scene, cfg, y) {
  const top = y + CEIL;

  slabWithHole(b, M.carpet, -HALF_W, y - 0.3, BACK, HALF_W, y, -0.3, SHAFT);
  slabWithHole(b, M.ceiling, -HALF_W, top, BACK, HALF_W, y + FH, -0.3, SHAFT);
  b.box(M.wall, -HALF_W, y, BACK, -HALF_W + 0.15, top, -0.3);
  b.box(M.wall, HALF_W - 0.15, y, BACK, HALF_W, top, -0.3);
  core(b, M, scene, y);

  // 층 안내판
  const floorSign = canvasPlane(1.6, 1.5, (g, w, h) => {
    g.fillStyle = '#131a2b';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ff8a2a';
    g.font = font(h * 0.42, 900);
    g.fillText(`${cfg.myFloor}F`, w / 2, h * 0.33);
    g.fillStyle = '#fff';
    g.font = font(h * 0.12, 800);
    g.fillText(cfg.org, w / 2, h * 0.68, w * 0.9);
    g.fillStyle = '#c9d2e3';
    g.font = font(h * 0.075, 600);
    g.fillText(cfg.company, w / 2, h * 0.86, w * 0.9);
  }, { ppm: 260 });
  place(scene, floorSign.mesh, 0.3, y + 1.85, CORE_FRONT + 0.012);

  // 책상 섬 세 줄. 엘리베이터 앞은 통로로 비워 둔다.
  const islands = [-5.5, -10.5, -15.5];
  const rng = makeRng(7);
  const MY = { x: 0.4, zc: islands[0], dir: 1 };
  for (const zc of islands) {
    for (const [xs, n] of [[-15.2, 6], [0.4, 9]]) {
      b.box(M.navy, xs, y + 0.78, zc - 0.03, xs + n * 1.6, y + 1.2, zc + 0.03);
      for (let i = 0; i < n; i++) {
        for (const dir of [-1, 1]) {
          const x = xs + i * 1.6;
          const mine = x === MY.x && zc === MY.zc && dir === MY.dir;
          desk(b, M, x, y, zc, dir, { mine, rng });
        }
      }
    }
  }

  // 내 자리: 명패, 환영 화면, 웰컴 키트, 풍선, 현수막
  const mx = MY.x;
  const mz = MY.zc;
  const seat = new THREE.Vector3(mx + 0.8, y, mz + 1.25);
  b.box(M.white, mx + 0.42, y + 1.2, mz - 0.015, mx + 1.18, y + 1.5, mz + 0.015, NS);
  const plate = canvasPlane(0.72, 0.26, (g, w, h) => {
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ff8a2a';
    g.fillRect(0, 0, w * 0.035, h);
    g.fillStyle = '#131a2b';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(h * 0.46, 900);
    g.fillText(cfg.name, w / 2, h * 0.4, w * 0.88);
    g.fillStyle = '#5b6578';
    g.font = font(h * 0.2, 700);
    g.fillText(cfg.org, w / 2, h * 0.78, w * 0.88);
  }, { ppm: 500 });
  place(scene, plate.mesh, mx + 0.8, y + 1.35, mz + 0.02);

  const screen = canvasPlane(0.54, 0.32, (g, w, h) => {
    g.fillStyle = '#0f1830';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ff9a3d';
    g.font = font(h * 0.26, 900);
    g.fillText('WELCOME!', w / 2, h * 0.36);
    g.fillStyle = '#fff';
    g.font = font(h * 0.17, 700);
    g.fillText(`${cfg.name} 님`, w / 2, h * 0.68, w * 0.9);
  }, { ppm: 500 });
  place(scene, screen.mesh, mx + 0.8, y + 1.09, mz + 0.2 + 0.03);

  b.box(M.orange, mx + 0.18, y + 0.78, mz + 0.42, mx + 0.42, y + 1.0, mz + 0.66, NS);
  b.box(M.white, mx + 0.28, y + 0.78, mz + 0.415, mx + 0.32, y + 1.005, mz + 0.665, NS);
  b.box(M.white, mx + 0.175, y + 0.78, mz + 0.52, mx + 0.425, y + 1.005, mz + 0.56, NS);
  const giftHit = place(scene, hitBox(0.45, 0.45, 0.45), mx + 0.3, y + 0.92, mz + 0.54);
  b.box(M.white, mx + 1.25, y + 0.78, mz + 0.5, mx + 1.33, y + 0.88, mz + 0.58, NS);

  // 액자 (열어 보면 쪽지가 나온다)
  const photo = drawPhoto();
  const photoTex = new THREE.CanvasTexture(photo);
  photoTex.magFilter = THREE.NearestFilter;
  photoTex.minFilter = THREE.NearestFilter;
  photoTex.generateMipmaps = false;
  photoTex.colorSpace = THREE.SRGBColorSpace;
  const frame = new THREE.Group();
  const picture = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.225), new THREE.MeshBasicMaterial({ map: photoTex }));
  picture.position.z = 0.017;
  frame.add(blockMesh(M.wood, 0.36, 0.285, 0.03), picture);
  frame.position.set(mx + 1.36, y + 0.78 + 0.14, mz + 0.2);
  frame.rotation.x = -0.14;
  scene.add(frame);
  const frameHit = place(scene, hitBox(0.44, 0.4, 0.3), mx + 1.36, y + 0.95, mz + 0.22);

  // 노트북을 놓을 자리, 커피 머신, 회의실 화면
  const laptopHit = place(scene, hitBox(0.6, 0.36, 0.42), mx + 0.8, y + 0.94, mz + 0.56);
  const coffeeHit = place(scene, hitBox(0.7, 0.7, 0.7), 11.25, y + 1.2, -25.4);
  const meetingScreen = canvasPlane(2.4, 1.2, (g, w, h) => {
    g.fillStyle = '#0f1830';
    g.fillRect(0, 0, w, h);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#ff9a3d';
    g.font = font(h * 0.2, 900);
    g.fillText('TEAM MEETING', w / 2, h * 0.3);
    g.fillStyle = '#fff';
    g.font = font(h * 0.15, 800);
    g.fillText(`새 팀원 소개 · ${cfg.name} 님`, w / 2, h * 0.58, w * 0.9);
    g.fillStyle = '#c9d2e3';
    g.font = font(h * 0.09, 600);
    g.fillText(cfg.org, w / 2, h * 0.8, w * 0.9);
  }, { ppm: 200 });
  place(scene, meetingScreen.mesh, -HALF_W + 0.232, y + 1.9, -22.5, Math.PI / 2);
  meetingScreen.mesh.visible = false;

  const bz = mz + 1.9;
  b.box(M.orange, mx - 0.9, y + 2.75, bz, mx + 2.5, y + 3.4, bz + 0.06, NS);
  b.box(M.white, mx - 0.7, y + 3.4, bz + 0.02, mx - 0.67, top, bz + 0.05, NS);
  b.box(M.white, mx + 2.27, y + 3.4, bz + 0.02, mx + 2.3, top, bz + 0.05, NS);
  sign(scene, `WELCOME  ${cfg.name} 님`, 3.2, 0.55, mx + 0.8, y + 3.075, bz - 0.005, FACE_BACK, { size: 0.6 });

  const balloons = [];
  const colors = [0xff8a2a, 0x3aa0ff, 0xffffff];
  // 책상 모서리에 묶어 둔 풍선 (통로를 가리지 않게 책상 위에 띄운다)
  [[mx + 0.16, 2.0, mz + 0.14], [mx + 0.34, 2.35, mz + 0.3], [mx + 0.12, 2.2, mz + 0.42]].forEach(([bx, by, bz2], i) => {
    const g = new THREE.Group();
    const len = by - 0.17 - 0.78;
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), new THREE.MeshLambertMaterial({ color: colors[i] }));
    const string = new THREE.Mesh(new THREE.BoxGeometry(0.015, len, 0.015), new THREE.MeshBasicMaterial({ color: 0xdddddd }));
    string.position.y = -len / 2 - 0.17;
    g.add(cube, string);
    g.position.set(bx, y + by, bz2);
    scene.add(g);
    balloons.push({ group: g, baseY: y + by, phase: i * 1.7 });
  });

  // 멀리서도 내 자리가 보이게 하는 빛기둥
  const beacon = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 2.9, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.35, depthWrite: false }),
  );
  place(scene, beacon, mx + 0.8, y + 0.78 + 1.45, mz + 0.4);

  // 회의실 (뒤쪽 왼편)
  b.box(M.glass, -HALF_W + 0.15, y, -19.1, -10.5, top, -19);
  b.box(M.glass, -10.5, y + 2.4, -19.1, -9.1, top, -19);
  b.box(M.glass, -9.1, y, BACK + 0.15, -9, top, -19);
  b.box(M.wood, -16, y + 0.7, -23.4, -12, y + 0.78, -21.6, NS);
  b.box(M.white, -15.5, y, -22.8, -12.5, y + 0.7, -22.2, NS);
  b.collider(-16, y, -23.4, -12, y + 0.78, -21.6);
  for (const cx of [-15.2, -14, -12.8]) {
    chair(b, M, cx, y, -24.0, 'z', -1);
    chair(b, M, cx, y, -21.0, 'z', 1);
  }
  b.box(M.black, -HALF_W + 0.15, y + 1.2, -23.8, -HALF_W + 0.22, y + 2.6, -21.2, NS);
  b.box(M.screen, -HALF_W + 0.22, y + 1.26, -23.74, -HALF_W + 0.226, y + 2.54, -21.26, NS);
  sign(scene, '회의실', 1.0, 0.3, -11.6, y + 1.6, -18.985, 0, { bg: '#131a2b', size: 0.6 });

  // 라운지 (뒤쪽 오른편)
  b.box(M.white, 10, y, BACK + 0.15, 16.5, y + 0.9, -25.1);
  b.box(M.wood, 9.95, y + 0.9, BACK + 0.15, 16.55, y + 0.95, -25.05, NS);
  b.box(M.steel, 16.6, y, BACK + 0.15, 17.6, y + 2.0, -25.0);
  b.box(M.black, 11, y + 0.95, -25.7, 11.5, y + 1.4, -25.3, NS);
  b.box(M.orange, 11.1, y + 1.3, -25.3, 11.4, y + 1.36, -25.29, NS);
  b.box(M.steel, 12.4, y + 0.95, -25.7, 13.1, y + 1.3, -25.3, NS);
  b.box(M.wood, 11.5, y + 1.0, -23.2, 14.5, y + 1.06, -22.4, NS);
  b.box(M.darkMetal, 12.9, y, -22.9, 13.1, y + 1.0, -22.7, NS);
  b.collider(11.5, y, -23.2, 14.5, y + 1.06, -22.4);
  for (const sx of [12, 13, 14]) {
    b.box(M.darkMetal, sx - 0.04, y, -21.94, sx + 0.04, y + 0.68, -21.86, NS);
    b.box(M.orange, sx - 0.18, y + 0.68, -22.08, sx + 0.18, y + 0.75, -21.72, NS);
  }
  sign(scene, '라운지', 1.4, 0.36, 13.2, y + 2.6, BACK + 0.16, 0, { bg: '#131a2b', size: 0.6 });

  for (const [x, z] of [[-16.9, -1.6], [16.9, -1.6], [16.9, -18.5], [-7.2, -17.6], [8, -20.5]]) plant(b, M, x, y, z);

  return {
    seat,
    beacon,
    balloons,
    giftHit,
    photo,
    frameHit,
    laptopHit,
    coffeeHit,
    meetingScreen: meetingScreen.mesh,
    my: { x: mx, zc: mz },
  };
}
