import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const FONT = "'Malgun Gothic', 'Apple SD Gothic Neo', 'Noto Sans KR', system-ui, sans-serif";
export const font = (px, weight = 700) => `${weight} ${Math.max(1, Math.round(px))}px ${FONT}`;

// 좌표 기준으로 UV를 잡아, 맞닿은 블록끼리 무늬가 이어지게 한다.
export function worldUV(geo, tile = [1, 1]) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const [tu, tv] = tile;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    if (Math.abs(nor.getX(i)) > 0.5) uv.setXY(i, z / tu, y / tv);
    else if (Math.abs(nor.getY(i)) > 0.5) uv.setXY(i, x / tu, z / tv);
    else uv.setXY(i, x / tu, y / tv);
  }
  uv.needsUpdate = true;
  return geo;
}

// 움직이는 물체(문, 엘리베이터 등)에 쓰는 개별 블록
export function blockMesh(mat, w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  worldUV(g, mat.userData.tile);
  return new THREE.Mesh(g, mat);
}

export function makeCollider(x0, y0, z0, x1, y1, z1) {
  return {
    min: new THREE.Vector3(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)),
    max: new THREE.Vector3(Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)),
    active: true,
  };
}

// 고정된 블록을 재질별로 모아 한 번에 그린다.
export class Builder {
  constructor(scene) {
    this.scene = scene;
    this.buckets = new Map();
    this.colliders = [];
  }

  box(mat, x0, y0, z0, x1, y1, z1, opts = {}) {
    const w = Math.abs(x1 - x0);
    const h = Math.abs(y1 - y0);
    const d = Math.abs(z1 - z0);
    if (!mat || w <= 0 || h <= 0 || d <= 0) {
      console.warn('잘못된 블록', { x0, y0, z0, x1, y1, z1 });
      return;
    }
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    worldUV(g, mat.userData.tile);
    if (!this.buckets.has(mat)) this.buckets.set(mat, []);
    this.buckets.get(mat).push(g);
    if (opts.solid !== false) this.collider(x0, y0, z0, x1, y1, z1);
  }

  collider(x0, y0, z0, x1, y1, z1) {
    const c = makeCollider(x0, y0, z0, x1, y1, z1);
    this.colliders.push(c);
    return c;
  }

  finish() {
    for (const [mat, geos] of this.buckets) {
      const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
      if (mat.transparent) mesh.renderOrder = 1;
      this.scene.add(mesh);
      geos.forEach((g) => g.dispose());
    }
    this.buckets.clear();
  }
}

// 글자나 표시판처럼 캔버스에 그린 그림을 붙인 판
export function canvasPlane(w, h, draw, { ppm = 160, transparent = false } = {}) {
  const c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(w * ppm));
  c.height = Math.max(2, Math.round(h * ppm));
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  const redraw = (fn) => {
    g.clearRect(0, 0, c.width, c.height);
    fn(g, c.width, c.height);
    tex.needsUpdate = true;
  };
  redraw(draw);
  return { mesh, redraw };
}

// 한 줄 글자를 가운데에 그리는 그리기 함수
export function textDraw(text, { color = '#fff', bg = null, size = 0.6, weight = 800, spacing = 0 } = {}) {
  return (g, w, h) => {
    if (bg) {
      g.fillStyle = bg;
      g.fillRect(0, 0, w, h);
    }
    g.fillStyle = color;
    g.font = font(h * size, weight);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    try {
      g.letterSpacing = `${Math.round(h * spacing)}px`;
    } catch {
      /* 지원하지 않는 브라우저는 자간 없이 */
    }
    g.fillText(text, w / 2, h / 2 + h * 0.03, w * 0.94);
  };
}

// 조준하기 쉽도록 실제 물체보다 넉넉한, 보이지 않는 상호작용 영역
const HIT_MAT = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
export function hitBox(w, h, d) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), HIT_MAT);
}
