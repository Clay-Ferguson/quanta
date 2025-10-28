import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';

/** 
 * Configuration manager class that loads and provides access to YAML configuration 
 */
class Config {
    private configData: any = {};

    constructor() {
        this.loadConfig();
    }

    /**
     * Load configuration from YAML file
     */
    private loadConfig(): void {
        const CONFIG_FILE = process.env.CONFIG_FILE;
        if (!CONFIG_FILE) {
            // console.error("CONFIG_FILE environment variable is not set.");
            throw new Error("CONFIG_FILE environment variable is required.");
        }
        try {
            const configFile = fs.readFileSync(CONFIG_FILE, 'utf8');
            this.configData = yaml.load(configFile) as any;
            
            // Dynamically scan and load plugins using the array from config
            const pluginKeys = Array.isArray(this.configData.plugins) ? this.configData.plugins : [];
            this.configData.plugins = Config.scanPlugins(pluginKeys);
            
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
    /**
     * Scan the plugins directory for plugin configuration files
     * and dynamically build the plugins array, only including those
     * whose folder name or key is present in the provided pluginKeys array.
     */
    static scanPlugins(pluginKeys: string[]): any[] {
        const enabledPlugins: any[] = [];
        const currentDir = process.cwd();
        let pluginsDir = path.join(currentDir, "plugins");

        // If plugins directory doesn't exist, try dist/plugins (for Docker builds)
        if (!fs.existsSync(pluginsDir)) {
            const distPluginsDir = path.join(currentDir, "dist", "plugins");
            console.log(`DEBUG: plugins directory not found, trying dist/plugins at: ${distPluginsDir}`);

            if (fs.existsSync(distPluginsDir)) {
                pluginsDir = distPluginsDir;
                console.log(`DEBUG: Using dist/plugins directory`);
            } else {
                console.log("No plugins directory found (checked both plugins and dist/plugins)");
                return enabledPlugins;
            }
        }

        const pluginFolders = fs.readdirSync(pluginsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const pluginFolder of pluginFolders) {
            // Only load plugins whose folder name or key is in pluginKeys
            if (!pluginKeys.includes(pluginFolder)) {
                continue;
            }
            const configPath = path.join(pluginsDir, pluginFolder, "config.yaml");

            if (fs.existsSync(configPath)) {
                try {
                    const configContent = fs.readFileSync(configPath, 'utf8');
                    const pluginConfig = yaml.load(configContent) as any;
                    // Optionally, check for a 'key' property in the config and match that too
                    if (pluginConfig.key && !pluginKeys.includes(pluginConfig.key) && !pluginKeys.includes(pluginFolder)) {
                        continue;
                    }
                    console.log(`Discovered plugin: ${pluginConfig.name || pluginFolder} (${pluginConfig.key || pluginFolder})`);
                    enabledPlugins.push(pluginConfig);
                } catch (error) {
                    console.error(`Error loading plugin config from ${configPath}:`, error);
                }
            }
        }

        console.log(`Loaded ${enabledPlugins.length} plugins dynamically`);
        return enabledPlugins;
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
}

// Create and export singleton instance
export const config = new Config();
