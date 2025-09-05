import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

/** 
 * Configuration manager class that loads and provides access to YAML configuration 
 */
class Config {
    private configData: any = {};
    public dbActive: boolean = !!process.env.POSTGRES_HOST;

    constructor() {
        this.loadConfig();
    }

    /**
     * Load configuration from YAML file
     */
    private loadConfig(): void {
        const CONFIG_FILE = process.env.CONFIG_FILE || 'config.yaml';
        try {
            const configFile = fs.readFileSync(CONFIG_FILE, 'utf8');
            this.configData = yaml.load(configFile) as any;
            
            // Dynamically scan and load plugins
            const discoveredPlugins = Config.scanPlugins();
            if (discoveredPlugins.length > 0) {
                this.configData.plugins = discoveredPlugins;
            }
            
            console.log(`Configuration loaded successfully from ${CONFIG_FILE}`);
            console.log('Config:', JSON.stringify(this.configData, null, 2));
        } catch (error) {
            console.warn(`Could not load ${CONFIG_FILE} file:`, error instanceof Error ? error.message : error);
            console.log('Continuing with default configuration...');
        }
    }

    /**
     * Scan the plugins directory for plugin configuration files
     * and dynamically build the plugins array
     */
    static scanPlugins(): any[] {
        const plugins: any[] = [];
        const pluginsDir = path.join(process.cwd(), "plugins");
        
        if (!fs.existsSync(pluginsDir)) {
            console.log("No plugins directory found");
            return plugins;
        }

        const pluginFolders = fs.readdirSync(pluginsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const pluginFolder of pluginFolders) {
            const configPath = path.join(pluginsDir, pluginFolder, "config.yaml");
            
            if (fs.existsSync(configPath)) {
                try {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const pluginConfig = yaml.load(configContent) as any;
                    
                    // Check if plugin is enabled (default to true if not specified)
                    const isEnabled = pluginConfig.enabled !== false;
                    
                    if (isEnabled) {
                        console.log(`Discovered plugin: ${pluginConfig.name} (${pluginConfig.key})`);
                        plugins.push(pluginConfig);
                    } else {
                        console.log(`Skipping disabled plugin: ${pluginConfig.name} (${pluginConfig.key})`);
                    }
                } catch (error) {
                    console.error(`Error loading plugin config from ${configPath}:`, error);
                }
            }
        }

        console.log(`Loaded ${plugins.length} plugins dynamically`);
        return plugins;
    }

    /**
     * Get the entire configuration object
     */
    get data(): any {
        return this.configData;
    }

    /**
     * Get a configuration value by key path (e.g., 'app.name')
     */
    get(keyPath: string): any {
        const keys = keyPath.split('.');
        let value = this.configData;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }

    /**
     * Get a public folder configuration by name
     */
    getPublicFolderByName(name: string): any {
        const folders = this.configData['public-folders'];
        if (!folders || !Array.isArray(folders)) {
            return undefined;
        }
        return folders.find((folder: any) => folder.name === name);
    }

    /**
     * Get a public folder configuration by key (if you add a 'key' property later)
     */
    getPublicFolderByKey(key: string): any {
        if (!key) {
            return undefined;
        }
        // Ensure 'public-folders' exists and is an array
        const folders = this.configData['public-folders'];
        if (!folders || !Array.isArray(folders)) {
            return undefined;
        }
        return folders.find((folder: any) => folder.key === key);
    }

    /**
     * Get all public folders
     */
    getPublicFolders(): any[] {
        return this.configData['public-folders'] || [];
    }

    /**
     * Get a public folder path by name
     */
    getPublicFolderPath(name: string): string | undefined {
        const folder = this.getPublicFolderByName(name);
        return folder?.path;
    }
}

// Create and export singleton instance
export const config = new Config();
