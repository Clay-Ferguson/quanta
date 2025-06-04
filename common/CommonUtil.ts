
// Object from the yaml file.
// NOTE: Used to initialize plugins on both client and server side. We sacrificed type safety on 'context' but it's ok.
export async function initPlugins(plugins: any, context: any) {
    console.log('Initializing plugins...');
    for (const plugin of plugins) {
        try {
            console.log(`plugin: ${plugin.key}`);
            const pluginModule = await import(`../server/plugins/${plugin.key}/init.js`);
            if (pluginModule.init) {
                pluginModule.init(context); // Initialize the plugin
            } else {
                console.warn(`Plugin ${plugin} does not have an init function.`);
            }
        } catch (error) {
            console.error(`Error initializing plugin ${plugin}:`, error);
        }
    }
}

// Currently this is only called by server and 'context' is the server instance.
export async function notifyPlugins(plugins: any, context: any) {
    console.log('Notify plugins startup is complete...');
    for (const plugin of plugins) {
        try {
            console.log(`notify plugin: ${plugin.key}`);
            const pluginModule = await import(`../server/plugins/${plugin.key}/init.js`);
            if (pluginModule.init) {
                pluginModule.notify(context); // Initialize the plugin
            } else {
                console.warn(`Plugin ${plugin} does not have an init function.`);
            }
        } catch (error) {
            console.error(`Error initializing plugin ${plugin}:`, error);
        }
    }
}