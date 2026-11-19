import * as THREE from 'three';
import { Npc, makeMarker } from './npc.js';
import { blockMesh, canvasPlane, font } from './builder.js';

const SKIN = [0xf2c9a5, 0xe8b88f, 0xd9a47a, 0xf7d7ba];
const HAIR = [0x2a211b, 0x3b2a20, 0x5a3b28, 0x1c1c22, 0x7a4a2a];
const SHIRT = [0x2f6fde, 0xf2f2f0, 0x3f9d6b, 0xd9534f, 0x8a63d2, 0xf2a03d, 0x35a7b8, 0x596579];
const PANTS = [0x2a3140, 0x3d4455, 0x25303f, 0x4a4036];
const look = (i, long = false) => ({
  skin: SKIN[i % 4],
  hair: HAIR[(i * 3) % 5],
  shirt: SHIRT[(i * 5) % 8],
  pants: PANTS[(i * 7) % 4],
  long,
});

const TEAM = ['lead', 'mentor', 'neighbor'];
const pick = (npc, lines) => lines[npc.count++ % lines.length];
const clock = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

// 동료 캐릭터, 대화, 첫날 미션, 액자 쪽지를 맡는다.
export function createStory({ scene, M, cfg, world, state, hud, player, confetti, showObjective }) {
  const F = cfg.myFloor;
  const yF = world.yF;
  const { x: mx, zc: mz } = world.my;

  // laptop: none → carried → installed / meeting: locked → open → running → done
  const m = { unlocked: false, laptop: 'none', greeted: new Set(), coffee: false, brewing: 0, meeting: 'locked', call: 0, arrived: 0, hint: 0 };
  let script = null; // 회의 장면처럼 차례로 흘러가는 대사
  let noteOpen = false;

  // ── 대사 ──
  const teamTalk = (id, before, greet, after) => (n) => {
    if (m.meeting === 'done') return pick(n, ['수고했어요! 내일 봬요.', '첫날 치고 완벽했어요.']);
    if (m.meeting === 'open') return '회의실에서 봐요!';
    if (!m.unlocked) return pick(n, before);
    if (!m.greeted.has(id)) {
      m.greeted.add(id);
      refresh();
      return greet;
    }
    return pick(n, after);
  };

  const itTalk = (n) => {
    if (!m.unlocked) return pick(n, ['노트북은 자리 배정이 끝난 뒤에 받으러 오세요.', 'IT 지원 창구입니다. 장비 문제는 언제든 오세요.']);
    if (m.laptop === 'none') {
      m.laptop = 'carried';
      refresh();
      return '여기 새 노트북입니다. 비밀번호는 포스트잇에 적어 두지 마세요!';
    }
    return pick(n, ['자리에 가서 설치해 보세요.', '안 켜지면… 일단 껐다 켜 보세요.']);
  };

  const seated = (i, name, x, z, yaw, lines) => ({
    id: `desk${i}`,
    name,
    look: look(i + 10, i % 2 === 0),
    pos: [x, yF, z],
    yaw,
    mode: 'sit',
    talk: (n) => pick(n, lines),
  });

  const defs = [
    {
      id: 'reception',
      name: '안내 직원',
      look: { skin: SKIN[3], hair: HAIR[1], shirt: 0xf2f2f0, pants: 0x25303f, long: true },
      pos: [-11.9, 0, -11.6],
      talk: (n) =>
        state.hasBadge
          ? pick(n, ['사원증은 게이트 리더기에 태깅하시면 돼요.', `첫 출근 축하드려요, ${cfg.name} 님!`])
          : pick(n, ['안녕하세요! 신규 입사자시죠?', '데스크 위에 떠 있는 사원증을 가져가세요.']),
    },
    {
      id: 'guard',
      name: '보안 요원',
      look: { skin: SKIN[2], hair: HAIR[3], shirt: 0x1f2a44, pants: 0x1b2233 },
      pos: [4.7, 0, -13.4],
      talk: (n) =>
        world.gate.open
          ? pick(n, ['좋은 하루 보내세요. 엘리베이터는 안쪽입니다.', '퇴근할 때도 인사하고 가세요.'])
          : pick(n, ['사원증을 리더기에 태깅해 주세요.', '사원증이 없으면 안내 데스크로 가 보세요.']),
    },
    {
      id: 'visitor',
      name: '면접 대기자',
      look: look(2, true),
      pos: [9.5, 0, -6.8],
      yaw: Math.PI,
      mode: 'sit',
      seatTop: 0.42,
      talk: (n) => pick(n, ['면접 보러 왔는데 너무 떨려요…', '혹시 여기 다니세요? 분위기 어때요?', '합격하면 저도 저 게이트를 지나가 보고 싶네요.']),
    },
    {
      id: 'commuter',
      name: '출근하는 동료',
      look: look(5),
      pos: [5.5, 0, -5],
      mode: 'walk',
      path: [[5.5, -5], [-7, -5], [-7, -8], [5.5, -8]],
      talk: (n) => pick(n, ['월요일 아침 엘리베이터는 전쟁이에요.', '오늘 첫 출근이세요? 긴장 푸세요, 다들 좋은 분들이에요.']),
    },
    { id: 'it', name: 'IT 지원 담당', look: look(6), pos: [13, 0, -22.3], talk: itTalk },
    {
      id: 'lead',
      name: '팀장님',
      look: { skin: SKIN[1], hair: HAIR[0], shirt: 0x596579, pants: 0x25303f },
      pos: [-0.6, yF, -14],
      yaw: Math.PI,
      talk: teamTalk(
        'lead',
        ['어서 와요! 자리는 저쪽, 주황색 빛기둥이 있는 곳이에요.', '천천히 둘러봐요. 오늘은 적응하는 날이니까.'],
        '환영합니다! 우리 팀에 와 줘서 든든해요.',
        ['장비 받고 팀원들과 인사부터 해요.', '커피 한 잔 하고 와요. 라운지는 저 안쪽이에요.'],
      ),
    },
    {
      id: 'mentor',
      name: '멘토 선배',
      look: look(3, true),
      pos: [mx + 0.8, yF, mz - 1.25],
      mode: 'sit',
      talk: teamTalk(
        'mentor',
        ['새로 오신 분이죠? 자리는 바로 맞은편이에요.'],
        '제가 멘토예요. 첫 주는 온보딩 문서만 읽어도 성공입니다.',
        ['모르는 건 바로 물어봐요. 혼자 끙끙대는 게 제일 손해예요.', '노트북은 1층 IT 지원 창구에서 받아요.'],
      ),
    },
    {
      id: 'neighbor',
      name: '옆자리 동료',
      look: look(4),
      pos: [mx + 2.4, yF, mz + 1.25],
      yaw: Math.PI,
      mode: 'sit',
      talk: teamTalk(
        'neighbor',
        ['옆자리 주인이 오셨네요! 풍선은 제가 불었어요.'],
        '옆자리예요, 반가워요! 근처 맛집 리스트 공유해 드릴게요.',
        ['그 웰컴 키트, 머그컵이 제일 쓸 만해요.', '점심 메뉴 고민은 저한테 맡기세요.'],
      ),
    },
    {
      id: 'peer',
      name: '입사 동기',
      look: look(7, true),
      pos: [15.6, yF, -8],
      mode: 'walk',
      speed: 1.4,
      path: [[15.6, -8], [-2.5, -8], [-2.5, -18.3], [15.6, -18.3]],
      talk: (n) => pick(n, ['저도 오늘 입사했어요! 같이 점심 먹어요.', '자리 못 찾아서 세 바퀴째 돌고 있어요…']),
    },
    {
      id: 'barista',
      name: '커피 장인',
      look: look(9),
      pos: [15.3, yF, -24.2],
      yaw: Math.PI,
      talk: (n) => pick(n, ['이 머신은 원두를 방금 갈았을 때가 제일 맛있어요.', '하루 세 잔까지는 건강식입니다.']),
    },
    seated(0, '개발자', 6.0, -9.25, Math.PI, ['빌드 돌리는 중이에요… 5분만요.', '어, 새로 오셨어요? 반가워요!']),
    seated(1, '디자이너', -11.2, -11.75, 0, ['이 파란색이랑 저 파란색, 차이 보이세요?', '환영해요! 자리 예쁘게 꾸몄네요.']),
    seated(2, '엔지니어', 10.8, -14.25, Math.PI, ['지금 배포 중이라… 숨 참고 있어요.', '무사히 끝났다! 아, 안녕하세요.']),
    seated(3, '기획자', -8.0, -4.25, Math.PI, ['회의가 회의를 낳고 있어요.', '첫날인데 벌써 적응하신 것 같은데요?']),
    seated(4, '데이터 분석가', 9.2, -6.75, 0, ['이 그래프가 왜 이러는지 아시는 분…', '첫 출근 축하드려요!']),
  ];

  const npcs = defs.map((d) => new Npc(scene, d));
  const byId = Object.fromEntries(npcs.map((n) => [n.id, n]));

  function talkTo(npc) {
    const text = npc.def.talk(npc);
    npc.talkTimer = 3.5;
    hud.showDialog(npc.name, text);
  }

  // ── 할 일이 있는 곳의 표식 ──
  const spots = [
    { mesh: makeMarker(), pos: [11.25, yF + 1.85, -25.4], on: () => m.unlocked && !m.coffee },
    { mesh: makeMarker(), pos: [mx + 0.8, yF + 1.6, mz + 0.56], on: () => m.laptop === 'carried' },
    { mesh: makeMarker(), pos: [-9.8, yF + 2.5, -18.9], on: () => m.meeting === 'open' },
    { mesh: makeMarker('heart'), pos: [mx + 1.36, yF + 1.34, mz + 0.2], on: () => !state.noteSeen },
  ];
  for (const s of spots) {
    s.mesh.visible = false;
    scene.add(s.mesh);
  }

  // ── 미션 ──
  function objective() {
    if (m.meeting === 'done') return { text: '첫날 미션 완료! 자유롭게 둘러보세요', label: '완료' };
    if (m.meeting === 'open' || m.meeting === 'running') return { text: '회의실에서 열리는 첫 팀 미팅에 참석하세요', label: '첫날 미션' };
    return { text: '첫날 미션을 하나씩 해결하세요', label: '첫날 미션' };
  }

  function refresh() {
    if (!m.unlocked) return;
    const greeted = Math.min(3, m.greeted.size);
    const items = [
      { done: m.laptop === 'installed', text: m.laptop === 'carried' ? '노트북을 내 자리에 설치하기' : '1층 IT 지원 창구에서 노트북 받아 오기' },
      { done: greeted >= 3, text: `팀원 3명에게 인사하기 (${greeted}/3)` },
      { done: m.coffee, text: `${F}층 라운지에서 커피 뽑기` },
      { done: m.meeting === 'done', locked: m.meeting === 'locked', text: '회의실에서 첫 팀 미팅' },
    ];
    if (m.meeting === 'locked' && items[0].done && items[1].done && items[2].done) {
      openMeeting();
      items[3].locked = false;
    }
    hud.setMissions(items);
    hud.setInventory([m.laptop === 'carried' && '노트북', m.coffee && m.meeting !== 'done' && '커피'].filter(Boolean));
    for (const id of TEAM) byId[id].showMarker = m.meeting === 'locked' && !m.greeted.has(id);
    byId.it.showMarker = m.laptop === 'none';
    showObjective();
  }

  function unlock() {
    if (m.unlocked) return;
    m.unlocked = true;
    m.hint = 3.5;
    refresh();
  }

  function installLaptop() {
    m.laptop = 'installed';
    const base = blockMesh(M.darkMetal, 0.42, 0.02, 0.28);
    base.position.set(mx + 0.8, yF + 0.79, mz + 0.56);
    const lid = new THREE.Group();
    const screen = canvasPlane(0.38, 0.2, (g, w, h) => {
      g.fillStyle = '#0f1830';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = font(h * 0.24, 800);
      g.fillText('읽지 않은 메일', w / 2, h * 0.32);
      g.fillStyle = '#ff9a3d';
      g.font = font(h * 0.36, 900);
      g.fillText('128통', w / 2, h * 0.68);
    }, { ppm: 500 });
    screen.mesh.position.z = 0.011;
    lid.add(blockMesh(M.black, 0.42, 0.24, 0.02), screen.mesh);
    lid.position.set(mx + 0.8, yF + 0.92, mz + 0.41);
    lid.rotation.x = -0.2;
    scene.add(base, lid);
    hud.toast('노트북 설치 완료! 읽지 않은 메일이 벌써 128통…', 4500);
    refresh();
  }

  // 방금 나눈 대화나 알림이 지나간 뒤에 팀장님이 회의를 소집한다.
  function openMeeting() {
    m.meeting = 'open';
    m.call = 3.4;
  }

  function callMeeting() {
    world.meetingScreen.visible = true;
    hud.showDialog(byId.lead.name, '준비 다 됐네요. 회의실에서 첫 팀 미팅 합시다!', 5000);
    const onArrive = () => {
      m.arrived++;
    };
    const door = [[-9.8, -18.2], [-9.8, -20.2]];
    byId.lead.walkTo([[-2.5, -14], [-2.5, -18.2], ...door, [-16.9, -20.2], [-16.9, -22.5]], { finalYaw: Math.PI / 2, onArrive });
    byId.mentor.walkTo([[mx + 0.8, mz - 2.4], [-2, mz - 2.4], [-2, -18.2], ...door, [-11.3, -20.4], [-11.3, -21.9]], { finalYaw: -Math.PI / 2, onArrive });
    byId.neighbor.walkTo([[mx + 2.4, mz + 2.2], [-3, mz + 2.2], [-3, -18.2], ...door, [-10.2, -20.4], [-10.2, -23.3], [-11.3, -23.3]], { finalYaw: -Math.PI / 2, onArrive });
  }

  const inMeetingRoom = (p) => p.y > yF - 0.5 && p.x > -17.7 && p.x < -9.2 && p.z > -25.8 && p.z < -19.3;

  function startMeeting() {
    m.meeting = 'running';
    script = {
      i: 0,
      t: 0.6,
      lines: [
        ['lead', `자, 새 팀원을 소개합니다. ${cfg.name} 님!`],
        ['mentor', '환영해요! 온보딩은 제가 책임질게요.'],
        ['neighbor', '오늘 점심은 제가 쏩니다!'],
        ['lead', '이번 주 목표는 딱 하나, 적응하기. 이상, 회의 끝!'],
      ],
      onDone: finishMeeting,
    };
  }

  function finishMeeting() {
    m.meeting = 'done';
    confetti.burst(new THREE.Vector3(player.pos.x, yF + 1.9, player.pos.z), yF);
    hud.showCard('첫날 미션 완료!', `${cfg.name} 님, 오늘 하루 수고했어요`, `소요 시간 ${clock(state.playTime)}`, 12000);
    refresh();
  }

  // ── 액자 쪽지 ──
  function openNote() {
    noteOpen = true;
    state.noteSeen = true;
    hud.showNote(world.photo.toDataURL(), cfg.note);
  }

  function closeNote() {
    if (!noteOpen) return false;
    noteOpen = false;
    hud.hideNote();
    return true;
  }

  const interactables = [
    ...npcs.map((n) => ({
      object: n.hit,
      prompt: () => (script ? null : `말 걸기 · ${n.name}`),
      act: () => talkTo(n),
    })),
    { object: world.laptopHit, prompt: () => (m.laptop === 'carried' ? '노트북 설치하기' : null), act: installLaptop },
    {
      object: world.coffeeHit,
      prompt: () => (m.unlocked && !m.coffee && m.brewing <= 0 ? '커피 뽑기' : null),
      act() {
        m.brewing = 1.8;
        hud.toast('커피를 내리는 중…', 1800);
      },
    },
    { object: world.frameHit, prompt: () => (noteOpen ? null : '액자 보기'), act: openNote },
  ];

  function update(dt, time, camera) {
    const p = player.pos;
    for (const n of npcs) n.update(dt, time, p, camera);

    if (m.hint > 0) {
      m.hint -= dt;
      if (m.hint <= 0) hud.toast('첫날 미션이 열렸습니다. 왼쪽 위 목록을 확인하세요', 5000);
    }
    if (m.brewing > 0) {
      m.brewing -= dt;
      if (m.brewing <= 0) {
        m.coffee = true;
        hud.toast('커피 완성! 향이 좋네요');
        refresh();
      }
    }
    if (m.call > 0) {
      m.call -= dt;
      if (m.call <= 0) callMeeting();
    }
    if (m.meeting === 'open' && inMeetingRoom(p)) {
      if (m.arrived >= 3) startMeeting();
      else if (!m.waitNoted) {
        m.waitNoted = true;
        hud.toast('팀원들이 회의실로 오고 있습니다. 잠시 기다려 주세요', 4000);
      }
    }
    if (script) {
      script.t -= dt;
      if (script.t <= 0) {
        if (script.i >= script.lines.length) {
          const done = script.onDone;
          script = null;
          done();
        } else {
          const [id, text] = script.lines[script.i++];
          byId[id].talkTimer = 3.4;
          hud.showDialog(byId[id].name, text, 3600);
          script.t = 3.4;
        }
      }
    }
    if (noteOpen && Math.hypot(p.x - (mx + 1.36), p.z - (mz + 0.2)) > 2.8) closeNote();
  }

  // 표식은 멈춰 있을 때도 카메라를 향하도록 매 프레임 갱신한다.
  function face(camera, time) {
    spots.forEach((s, i) => {
      s.mesh.visible = s.on();
      if (!s.mesh.visible) return;
      s.mesh.position.set(s.pos[0], s.pos[1] + Math.sin(time * 3 + i) * 0.05, s.pos[2]);
      s.mesh.quaternion.copy(camera.quaternion);
    });
  }

  return { interactables, update, face, unlock, objective, closeNote, missions: m, npcs, byId };
}
