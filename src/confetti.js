import * as THREE from 'three';

const COLORS = [0xff8a2a, 0x3aa0ff, 0xffffff, 0xffd23f, 0x5ad17a, 0xff5d8f];

// 블록 색종이
export class Confetti {
  constructor(scene, count = 360) {
    this.count = count;
    this.mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.07, 0.07, 0.02),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      count,
    );
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.parts = [];
    this.settled = true;
    this.floorY = 0;
    this.dummy = new THREE.Object3D();
  }

  burst(origin, floorY) {
    this.floorY = floorY;
    this.settled = false;
    this.parts = [];
    const color = new THREE.Color();
    for (let i = 0; i < this.count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 3.2;
      this.parts.push({
        p: new THREE.Vector3(origin.x + (Math.random() - 0.5) * 1.6, origin.y + Math.random() * 0.6, origin.z + (Math.random() - 0.5) * 1.6),
        v: new THREE.Vector3(Math.cos(a) * s, 1 + Math.random() * 2.6, Math.sin(a) * s),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12),
        rest: false,
      });
      this.mesh.setColorAt(i, color.setHex(COLORS[i % COLORS.length]));
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.mesh.visible = true;
    this.write();
  }

  write() {
    const d = this.dummy;
    this.parts.forEach((q, i) => {
      d.position.copy(q.p);
      d.rotation.set(q.r.x, q.r.y, q.r.z);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    // 다 떨어진 조각은 바닥에 그대로 남겨 둔다.
    if (!this.mesh.visible || this.settled) return;
    this.settled = true;
    for (const q of this.parts) {
      if (q.rest) continue;
      this.settled = false;
      q.v.y -= 4.5 * dt;
      q.v.multiplyScalar(1 - 1.2 * dt);
      q.p.addScaledVector(q.v, dt);
      q.r.addScaledVector(q.w, dt);
      if (q.p.y <= this.floorY + 0.02) {
        q.p.y = this.floorY + 0.02;
        q.r.set(Math.PI / 2, q.r.y, 0);
        q.rest = true;
      }
    }
    this.write();
  }
}
