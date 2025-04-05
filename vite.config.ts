import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    css: {
        preprocessorOptions: {
            scss: {
                // Add any global SCSS variables you want available everywhere
                // additionalData: `@import "./src/styles/variables.scss";`
            },
        },
    },
})
