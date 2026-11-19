import { defineConfig } from 'vite';

// 상대 경로로 빌드해서, GitHub Pages처럼 하위 경로(/저장소이름/)에 올려도 동작하게 한다.
export default defineConfig({
  base: './',
});
