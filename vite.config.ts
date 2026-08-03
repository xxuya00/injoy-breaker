import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 여러 세션이 동시에 dev 서버를 띄울 때 겹치지 않도록, 지정된 PORT가 있으면 그 포트를 쓴다.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
})
