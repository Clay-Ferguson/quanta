import fs from 'fs';
import yaml from 'js-yaml';

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
        const CONFIG_FILE = process.env.CONFIG_FILE || 'config.yaml';
        try {
            const configFile = fs.readFileSync(CONFIG_FILE, 'utf8');
            this.configData = yaml.load(configFile) as any;
            console.log(`Configuration loaded successfully from ${CONFIG_FILE}`);
            console.log('Config:', JSON.stringify(this.configData, null, 2));
        } catch (error) {
            console.warn(`Could not load ${CONFIG_FILE} file:`, error instanceof Error ? error.message : error);
            console.log('Continuing with default configuration...');
        }
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
