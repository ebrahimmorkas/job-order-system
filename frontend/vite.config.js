import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Listen on IPv4 so names mapped to 127.0.0.1 in the hosts file (e.g.
    // localhost1) reach it - by default Vite may listen on ::1 only.
    host: '127.0.0.1',
    // Host names the dev server answers on. Each local vendor gets its own
    // name (e.g. localhost1), mapped to 127.0.0.1 in the hosts file - see
    // README.md. *.localhost names work without a hosts-file entry.
    allowedHosts: ['localhost', 'localhost1', 'localhost2', '.localhost'],
    // Forward /api requests to the Express backend during development
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        // false keeps the browser's Host header (e.g. localhost1), which is
        // how the backend tells vendors apart (vendorDetection).
        changeOrigin: false,
      },
    },
  },
})
