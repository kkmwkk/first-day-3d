// 빌드한 결과(dist)를 GitHub Pages가 읽는 gh-pages 브랜치에 올린다.
// 사용: npm run deploy  (gh CLI에 ACCOUNT 계정이 로그인되어 있어야 한다)
import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

const ACCOUNT = 'kkmwkk';
const REPO = 'first-day-3d';
const EMAIL = '92105168+kkmwkk@users.noreply.github.com';

await build();
writeFileSync('dist/.nojekyll', '');

// 다른 계정이 활성 상태여도 ACCOUNT의 토큰으로만 올린다. 토큰은 환경 변수로만 넘기고 파일에 남기지 않는다.
const token = execFileSync('gh', ['auth', 'token', '--user', ACCOUNT], { encoding: 'utf8' }).trim();
const git = (...args) =>
  execFileSync('git', args, { cwd: 'dist', stdio: 'inherit', env: { ...process.env, DEPLOY_TOKEN: token } });

rmSync('dist/.git', { recursive: true, force: true });
git('init', '-q', '-b', 'gh-pages');
git('add', '-A');
git('-c', `user.name=${ACCOUNT}`, '-c', `user.email=${EMAIL}`, 'commit', '-q', '-m', 'Deploy');
git(
  '-c', 'credential.helper=',
  '-c', 'credential.helper=!f() { echo username=x-access-token; echo "password=$DEPLOY_TOKEN"; }; f',
  'push', '-f', `https://github.com/${ACCOUNT}/${REPO}.git`, 'gh-pages',
);
rmSync('dist/.git', { recursive: true, force: true });

console.log(`\n배포 완료: https://${ACCOUNT}.github.io/${REPO}/ (반영까지 1~2분)`);
