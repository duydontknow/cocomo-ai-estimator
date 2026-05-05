import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  envDir: '../', // Cấu hình đọc file .env từ thư mục root của cả project
  plugins: [react()],
  optimizeDeps: {
    include: ['tslib']
  }
})
