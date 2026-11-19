import * as THREE from 'three';

export function makeRng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const c8 = (v) => Math.max(0, Math.min(255, Math.round(v)));

function put(g, x, y, r, gr, b, a = 1) {
  g.fillStyle = `rgba(${c8(r)},${c8(gr)},${c8(b)},${a})`;
  g.fillRect(x, y, 1, 1);
}

function tex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function fillNoise(g, w, h, base, v, rand) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const d = (rand() - 0.5) * 2 * v;
      put(g, x, y, base[0] + d, base[1] + d, base[2] + d);
    }
}

const noiseTex = (base, v, seed, size = 16) =>
  tex(size, size, (g, w, h) => fillNoise(g, w, h, base, v, makeRng(seed)));

// 줄눈이 있는 타일
const gridTex = (base, v, line, cell, seed, size = 32) =>
  tex(size, size, (g, w, h) => {
    fillNoise(g, w, h, base, v, makeRng(seed));
    for (let i = 0; i < size; i++)
      for (let k = 0; k < size; k += cell) {
        put(g, k, i, ...line);
        put(g, i, k, ...line);
      }
  });

const woodTex = () =>
  tex(16, 16, (g) => {
    const r = makeRng(21);
    for (let y = 0; y < 16; y++) {
      const row = (r() - 0.5) * 22;
      for (let x = 0; x < 16; x++) {
        const d = row + (r() - 0.5) * 8;
        put(g, x, y, 156 + d, 112 + d, 70 + d);
      }
    }
  });

const steelTex = (base, seed) =>
  tex(16, 16, (g) => {
    const r = makeRng(seed);
    for (let x = 0; x < 16; x++) {
      const col = (r() - 0.5) * 14;
      for (let y = 0; y < 16; y++) {
        const d = col + (r() - 0.5) * 4;
        put(g, x, y, base[0] + d, base[1] + d, base[2] + d);
      }
    }
  });

const ceilingTex = () =>
  tex(32, 32, (g) => {
    fillNoise(g, 32, 32, [226, 227, 226], 3, makeRng(31));
    for (let i = 0; i < 32; i++)
      for (const k of [0, 16]) {
        put(g, k, i, 196, 198, 200);
        put(g, i, k, 196, 198, 200);
      }
    // 조명 패널 한 칸
    for (let y = 3; y < 14; y++) for (let x = 3; x < 14; x++) put(g, x, y, 255, 255, 244);
  });

const BAND = [
  [120, 128, 138],
  [206, 212, 218],
  [214, 219, 224],
  [150, 158, 168],
];

// 불투명 커튼월: 가로 8m(유리 4장) x 세로 4m(한 층)
const facadeTex = () =>
  tex(64, 32, (g) => {
    const r = makeRng(11);
    for (let p = 0; p < 4; p++) {
      const tone = (r() - 0.5) * 26;
      for (let y = 0; y < 28; y++)
        for (let x = 0; x < 16; x++) {
          const t = 1 - y / 27;
          let add = ((x + y + p * 5) % 23) < 3 ? 16 : 0;
          add += (r() - 0.5) * 8;
          put(g, p * 16 + x, y, 66 + tone + t * 62 + add, 116 + tone + t * 56 + add, 172 + tone * 0.6 + t * 46 + add);
        }
      for (let y = 0; y < 28; y++) put(g, p * 16, y, 46, 58, 74);
    }
    for (let x = 0; x < 64; x++) {
      put(g, x, 13, 58, 78, 104);
      BAND.forEach((c, i) => put(g, x, 28 + i, ...c));
    }
  });

// 안이 들여다보이는 커튼월: 가로 2m x 세로 4m
const facadeClearTex = () =>
  tex(16, 32, (g) => {
    g.clearRect(0, 0, 16, 32);
    for (let y = 0; y < 28; y++) for (let x = 0; x < 16; x++) put(g, x, y, 170, 215, 245, 0.16);
    for (let y = 0; y < 28; y++) {
      g.clearRect(0, y, 1, 1);
      put(g, 0, y, 60, 72, 88);
    }
    for (let x = 0; x < 16; x++) {
      g.clearRect(x, 13, 1, 1);
      put(g, x, 13, 60, 72, 88, 0.9);
      BAND.forEach((c, i) => put(g, x, 28 + i, ...c));
    }
  });

// 실내 유리 칸막이, 출입문: 2m 격자 프레임
const glassTex = () =>
  tex(16, 16, (g) => {
    g.clearRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(g, x, y, 180, 220, 245, 0.14);
    for (let i = 0; i < 16; i++) {
      g.clearRect(0, i, 1, 1);
      put(g, 0, i, 70, 82, 96);
      g.clearRect(i, 15, 1, 1);
      put(g, i, 15, 70, 82, 96);
    }
  });

function lambert(map, tile = [1, 1], extra = {}) {
  const m = new THREE.MeshLambertMaterial({ map, ...extra });
  m.userData.tile = tile;
  return m;
}

export function createMaterials() {
  const clear = { transparent: true, depthWrite: false };
  const ceil = ceilingTex();
  return {
    grass: lambert(noiseTex([96, 162, 74], 16, 1)),
    leaf: lambert(noiseTex([58, 128, 54], 24, 2)),
    hill: lambert(noiseTex([78, 138, 78], 12, 3), [4, 4]),
    trunk: lambert(noiseTex([112, 82, 52], 14, 4)),
    pave: lambert(gridTex([180, 182, 184], 8, [152, 154, 157], 16, 5), [2, 2]),
    asphalt: lambert(noiseTex([64, 66, 70], 8, 6)),
    concrete: lambert(noiseTex([170, 172, 174], 8, 7)),
    darkMetal: lambert(noiseTex([58, 64, 72], 5, 8)),
    steel: lambert(steelTex([178, 184, 190], 9)),
    steelDoor: lambert(steelTex([200, 205, 210], 10)),
    stoneDark: lambert(noiseTex([72, 76, 86], 6, 12)),
    marble: lambert(gridTex([222, 219, 211], 6, [190, 187, 180], 32, 13), [2, 2]),
    carpet: lambert(noiseTex([88, 100, 122], 10, 14)),
    wall: lambert(noiseTex([238, 238, 234], 3, 15)),
    ceiling: lambert(ceil, [2, 2], { emissive: 0xffffff, emissiveMap: ceil, emissiveIntensity: 0.35 }),
    wood: lambert(woodTex()),
    white: lambert(noiseTex([244, 244, 242], 2, 16)),
    black: lambert(noiseTex([34, 36, 40], 4, 17)),
    navy: lambert(noiseTex([26, 40, 78], 5, 18)),
    orange: lambert(noiseTex([240, 122, 44], 8, 19)),
    chair: lambert(noiseTex([54, 60, 72], 6, 20)),
    pot: lambert(noiseTex([204, 204, 198], 4, 22)),
    facade: lambert(facadeTex(), [8, 4]),
    facadeClear: lambert(facadeClearTex(), [2, 4], clear),
    glass: lambert(glassTex(), [2, 2], clear),
    flap: new THREE.MeshLambertMaterial({ color: 0x8fd0ff, transparent: true, opacity: 0.55, depthWrite: false }),
    screen: new THREE.MeshBasicMaterial({ color: 0x8fd3ff }),
    glow: new THREE.MeshBasicMaterial({ color: 0xfff2c0 }),
    cloud: new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false }),
  };
}
