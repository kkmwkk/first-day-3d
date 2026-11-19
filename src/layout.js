// 건물 치수 (단위: m). x는 좌우, z는 앞뒤(정면이 +z), y는 높이.
export const FH = 4; // 층고
export const CEIL = 3.7; // 실내 천장 높이
export const HALF_W = 18; // 본동 폭의 절반
export const BACK = -26; // 본동 뒷면 z
export const LOBBY_FRONT = -3; // 1층 로비 유리벽 z (위층보다 안쪽으로 들어가 있음)
export const WING = { x1: 30, z1: 16 }; // 양옆 동의 바깥 x, 앞쪽 z

export const SHAFT = { x0: -3.8, x1: -1.2, z0: -24.8, z1: -22.0 };
export const CAR = { x0: -3.7, x1: -1.3, z0: -24.7, z1: -22.0, h: 2.6 };
export const DOOR = { x0: -3.2, x1: -1.8, h: 2.3 };
export const CORE_FRONT = -21.6; // 엘리베이터 코어 벽 앞면 z

export const SPAWN = { x: 0, y: 0, z: 30 };
