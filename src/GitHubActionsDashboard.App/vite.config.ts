import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import svgr from 'vite-plugin-svgr'
import { tanstackRouter } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    svgr({
      svgrOptions: {
        plugins: ["@svgr/plugin-svgo", "@svgr/plugin-jsx"],
        svgoConfig: {
          plugins: [{
            name: "preset-default",
            params: { overrides: { removeViewBox: false, cleanupIds: false } },
          }],
        },
      },
      include: "**/*.svg",
    }),
    react()
  ],
  server: {
    port: 3010,
    proxy: {
      "/api": "http://localhost:5010",
      "/admin/session": "http://localhost:5010",
      "/login": "http://localhost:5010",
      "/callback": "http://localhost:5010",
    }
  },
},)
