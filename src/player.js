import * as THREE from 'three';
import { SPAWN } from './layout.js';

const EPS = 1e-4;
const STEP = 0.6; // 이 높이까지는 걸어서 올라선다
const AXES = ['x', 'z'];

export class Player {
  constructor(camera, colliders) {
    this.camera = camera;
    this.colliders = colliders;
    this.pos = new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z); // 발 위치
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.half = 0.3;
    this.height = 1.8;
    this.eye = 1.62;
    this.onGround = false;
    this.lockY = null; // 엘리베이터에 타고 있을 때 바닥 높이
  }

  respawn() {
    this.pos.set(SPAWN.x, SPAWN.y, SPAWN.z);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
  }

  hit(x, y, z) {
    for (const c of this.colliders) {
      if (
        c.active &&
        x + this.half > c.min.x + EPS &&
        x - this.half < c.max.x - EPS &&
        y + this.height > c.min.y + EPS &&
        y < c.max.y - EPS &&
        z + this.half > c.min.z + EPS &&
        z - this.half < c.max.z - EPS
      )
        return c;
    }
    return null;
  }

  moveAxis(axis, d) {
    if (d === 0) return;
    const p = this.pos;
    const old = p[axis];
    p[axis] += d;
    let c = this.hit(p.x, p.y, p.z);
    if (!c) return;
    if (this.onGround && this.lockY === null) {
      const rise = c.max.y - p.y;
      if (rise > 0 && rise <= STEP && !this.hit(p.x, c.max.y, p.z)) {
        p.y = c.max.y;
        return;
      }
    }
    for (let i = 0; i < 4 && c; i++) {
      p[axis] = d > 0 ? c.min[axis] - this.half : c.max[axis] + this.half;
      c = this.hit(p.x, p.y, p.z);
    }
    if (c) p[axis] = old;
    this.vel[axis] = 0;
  }

  moveY(d) {
    const p = this.pos;
    p.y += d;
    this.onGround = false;
    let c = this.hit(p.x, p.y, p.z);
    for (let i = 0; i < 4 && c; i++) {
      if (d <= 0) {
        p.y = c.max.y;
        this.onGround = true;
      } else {
        p.y = c.min.y - this.height;
      }
      this.vel.y = 0;
      c = this.hit(p.x, p.y, p.z);
    }
    // 아주 짧은 프레임에서는 바닥에 닿은 것이 감지되지 않으므로 발밑을 한 번 더 확인한다.
    if (!this.onGround && d <= 0 && this.hit(p.x, p.y - 0.03, p.z)) {
      this.onGround = true;
      this.vel.y = 0;
    }
  }

  // input: { f: 앞뒤(-1~1), r: 좌우(-1~1), jump, sprint }
  update(dt, input) {
    const speed = input.sprint ? 6.8 : 4.4;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let dx = -sin * input.f + cos * input.r;
    let dz = -cos * input.f - sin * input.r;
    const len = Math.hypot(dx, dz);
    if (len > 1) {
      dx /= len;
      dz /= len;
    }
    const k = Math.min(1, (this.onGround ? 14 : 5) * dt);
    this.vel.x += (dx * speed - this.vel.x) * k;
    this.vel.z += (dz * speed - this.vel.z) * k;

    if (this.lockY !== null) {
      this.pos.y = this.lockY;
      this.vel.y = 0;
      this.onGround = true;
    } else {
      this.vel.y -= 24 * dt;
      if (input.jump && this.onGround) {
        this.vel.y = 7.6;
        this.onGround = false;
      }
    }

    for (const a of AXES) this.moveAxis(a, this.vel[a] * dt);
    if (this.lockY === null) this.moveY(this.vel.y * dt);
    if (this.pos.y < -20) this.respawn();
    this.syncCamera();
  }

  syncCamera() {
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
