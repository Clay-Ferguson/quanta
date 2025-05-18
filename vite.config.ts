import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
let config = null;
const isDev = process.env.QUANTA_DEV === 'true'

if (!isDev) {
    // PRODUCTION
    console.log("PRODUCTION BUILD");
    config = {
        plugins: [react()],
        css: {
            preprocessorOptions: {
                scss: {
                    // Add any global SCSS variables you want available everywhere
                    // additionalData: `@import "./client/styles/variables.scss";`
                },
            },
        },
    }
}
else {
    // DEVELOPMENT
    console.log("DEVELOPMENT BUILD")
    config = {
        plugins: [react()],
        css: {
            preprocessorOptions: {
                scss: {
                    // Add any global SCSS variables you want available everywhere
                    // additionalData: `@import "./client/styles/variables.scss";`
                },
            },
        },
        build: {
            // Generate source maps for debugging
            sourcemap: true,
            // Disable minification to preserve line numbers
            minify: false,
            // Disable chunk size warnings
            chunkSizeWarningLimit: 10000,
            rollupOptions: {
                preserveEntrySignatures: 'strict',
                output: {
                    // Preserve module structure
                    preserveModules: true,
                    // Ensure consistent file names
                    entryFileNames: `assets/[name].js`,
                    chunkFileNames: `assets/[name].js`,
                    assetFileNames: `assets/[name].[ext]`
                }
            }
        }
    }
}

export default defineConfig(config as any);
