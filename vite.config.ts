import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// todo-0: I know this isn't the proper way to turn PROD on and off but 
// I'm doing this for now.

// https://vite.dev/config/
// PRODUCTION
// export default defineConfig({
//     plugins: [react()],
//     css: {
//         preprocessorOptions: {
//             scss: {
//                 // Add any global SCSS variables you want available everywhere
//                 // additionalData: `@import "./src/styles/variables.scss";`
//             },
//         },
//     },
// })

// DEVELOPMENT
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
})