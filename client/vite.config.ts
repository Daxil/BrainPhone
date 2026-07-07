import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        open: true,
        // В dev API-запросы идут на локальный бэкенд (server/, PORT=3001),
        // чтобы относительный /api работал без VITE_API_URL и CORS.
        proxy: {
            '/api': 'http://localhost:3001',
            '/health': 'http://localhost:3001',
        },
    },
    build: {
        outDir: 'dist',
        // Не публикуем исходники в проде (source maps раскрывают код клиента).
        sourcemap: false,
    },
})