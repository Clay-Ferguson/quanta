import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
let config = null;
const isDev = process.env.DEV_BUILD_OPTS === 'true'
// console.log(`DEV_BUILD_OPTS: ${process.env.DEV_BUILD_OPTS}`);

// Dynamically discover plugin client directories
function getPluginAliases() {
    const pluginsDir = path.resolve(__dirname, 'plugins')
    /* NOTE: These aliases are also in tsconfig.app.json file */
    const aliases: Record<string, string> = {
        '@client': path.resolve(__dirname, 'client'),
        '@common': path.resolve(__dirname, 'common'),
        '@plugins': pluginsDir
    }
    
    try {
        const pluginFolders = fs.readdirSync(pluginsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name)
        
        pluginFolders.forEach(pluginName => {
            const clientPath = path.join(pluginsDir, pluginName, 'client')
            if (fs.existsSync(clientPath)) {
                aliases[`@plugins/${pluginName}/client`] = clientPath
            }
        })
    } catch (err) {
        console.warn('Could not read plugins directory:', err)
    }
    
    return aliases
}

if (!isDev) {
    // PRODUCTION
    console.log("PRODUCTION BUILD");
    config = {
        plugins: [react()],
        root: '.', // Keep root at project level
        resolve: {
            alias: getPluginAliases()
        },
        build: {
            rollupOptions: {
                input: './server/index.html' // Use index.html from server folder
            }
        },
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
        root: '.', // Keep root at project level
        resolve: {
            alias: getPluginAliases()
        },
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
                input: './server/index.html', // Use index.html from server folder
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
