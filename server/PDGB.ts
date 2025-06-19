import { Pool, PoolClient } from 'pg';

interface PostgresConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
}

class PGDB {
    private pool: Pool | null = null;
    private isInitialized: boolean = false;

    constructor() {}

    /**
     * Initialize the PostgreSQL database connection and create tables/functions
     */
    async initDb(): Promise<void> {
        if (!process.env.POSTGRES_HOST) {
            throw new Error('POSTGRES_HOST environment variable is not set');
        }
        if (this.isInitialized) {
            return;
        }
        try {
            console.log('Initializing PostgreSQL Database...');

            // Get database configuration from environment variables
            const config: PostgresConfig = this.getDbConfig();
            
            // Create connection pool
            this.pool = new Pool({
                host: config.host,
                port: config.port,
                database: config.database,
                user: config.user,
                password: config.password,
                max: 20, // Maximum number of clients in the pool
                idleTimeoutMillis: 30000, // How long a client is allowed to remain idle
                connectionTimeoutMillis: 2000, // How long to wait when connecting
            });

            // Test the connection
            await this.testConnection();

            this.isInitialized = true;
            console.log('PostgreSQL Database initialized successfully');

        } catch (error) {
            console.error('Failed to initialize PostgreSQL Database:', error);
            throw error;
        }
    }
    
    /**
     * Get database configuration from environment variables or defaults
     */
    private getDbConfig(): PostgresConfig {
        return {
            host: process.env.POSTGRES_HOST || 'localhost',
            port: parseInt(process.env.POSTGRES_PORT || '5432'),
            database: process.env.POSTGRES_DB || 'quanta',
            user: process.env.POSTGRES_USER || 'quanta',
            password: process.env.POSTGRES_PASSWORD || 'pwd'
        };
    }

    /**
     * Test the database connection
     */
    private async testConnection(): Promise<void> {
        if (!this.pool) {
            throw new Error('Database pool not initialized');
        }

        const client = await this.pool.connect();
        try {
            const result = await client.query('SELECT NOW()');
            console.log('Database connection test successful:', result.rows[0].now);
        } finally {
            client.release();
        }
    }

    checkDb() {
        if (!this.isInitialized) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
        if (!this.pool) {
            throw new Error('Database not initialized. Call initDb() first.');
        }
    }

    /**
     * Get a client from the connection pool
     */
    async getClient(): Promise<PoolClient> {
        this.checkDb();
        return this.pool!.connect();
    }

    /**
     * Execute a query using the connection pool
     */
    async query(text: string, params?: any[]): Promise<any> {
        this.checkDb();
        return this.pool!.query(text, params);
    }

    /**
     * Check if the database is initialized
     */
    isReady(): boolean {
        return this.isInitialized && this.pool !== null;
    }

    /**
     * Close the database connection pool
     */
    async close(): Promise<void> {
        this.checkDb();
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.isInitialized = false;
            console.log('Database connection pool closed');
        }
    }
}

const pgdb = new PGDB();
export default pgdb;