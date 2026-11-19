// 내 자리 액자에 들어가는 픽셀 그림: 손을 잡은 두 사람과 하트
export function drawPhoto() {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 36;
  const g = c.getContext('2d');
  const r = (x, y, w, h, color) => {
    g.fillStyle = color;
    g.fillRect(x, y, w, h);
  };
  const SKIN = '#f2c9a5';

  r(0, 0, 48, 25, '#9fd0f5');
  r(0, 25, 48, 11, '#6fb25a');
  r(0, 25, 48, 1, '#5a9c48');
  r(39, 3, 5, 5, '#ffe27a');
  r(4, 6, 7, 2, '#ffffff');
  r(6, 5, 4, 1, '#ffffff');

  const person = (x, hair, long, shirt, pants) => {
    r(x - 2, 16, 2, 7, shirt);
    r(x + 8, 16, 2, 7, shirt);
    r(x, 8, 8, 8, SKIN);
    r(x, 7, 8, 3, hair);
    if (long) {
      r(x - 1, 8, 1, 9, hair);
      r(x + 8, 8, 1, 9, hair);
    }
    r(x + 2, 12, 1, 1, '#20242c');
    r(x + 5, 12, 1, 1, '#20242c');
    r(x + 3, 14, 2, 1, '#b5524a');
    r(x, 16, 8, 9, shirt);
    r(x, 25, 3, 7, pants);
    r(x + 5, 25, 3, 7, pants);
  };
  person(13, '#2a211b', false, '#2f6fde', '#2a3140');
  person(27, '#6a4630', true, '#ff8fa3', '#3d4455');
  r(22, 21, 4, 2, SKIN); // 맞잡은 손

  ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'].forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === 'X') r(21 + x, 1 + y, 1, 1, '#ff4d6d');
    }),
  );
  return c;
}
