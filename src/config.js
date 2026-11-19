// 여기 값만 고치면 명패, 안내판, 엘리베이터 버튼, 환영 문구가 전부 바뀝니다.
export const CONFIG = {
  name: '전민우',
  org: '소속 조직 (미정)',
  myFloor: 5, // 내 조직이 있는 층 (2 이상, totalFloors 이하)
  totalFloors: 6, // 사옥 지상 층수
  company: 'MEGAZONECLOUD',
};

export function resolveConfig(c = CONFIG) {
  const totalFloors = Math.max(2, Math.min(20, Math.round(c.totalFloors) || 6));
  const myFloor = Math.max(2, Math.min(totalFloors, Math.round(c.myFloor) || 2));
  return { ...c, totalFloors, myFloor };
}
