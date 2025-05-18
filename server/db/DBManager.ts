import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import {DBManagerIntf} from '../../common/types/CommonTypes.js';

const dbPath: string | undefined = process.env.QUANTA_CHAT_DB_FILE_NAME;
if (!dbPath) {
    throw new Error('Database path is not set');
}

export class DBManager implements DBManagerIntf {
    private db: Database | null = null;
    private tranCounter = 0;

    constructor() {
        this.initialize();
    }

    private async initialize(): Promise<void> {
        // Ensure data directory exists
        const dbDir = path.dirname(dbPath!);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Open and initialize the database
        console.log('Opening database:', dbPath);
        this.db = await open({
            filename: dbPath!,
            driver: sqlite3.Database
        });

        if (!this.db) {
            throw new Error('Failed to open database: ' + dbPath);
        }

        // Create tables if they don't exist
        console.log('Initializing database schema');
        await this.db.exec(`
            CREATE TABLE IF NOT EXISTS rooms (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL
            );

            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                room_id INTEGER NOT NULL,
                timestamp INTEGER NOT NULL,
                sender TEXT NOT NULL,
                content TEXT,
                public_key TEXT,
                signature TEXT,
                FOREIGN KEY (room_id) REFERENCES rooms (id)
            );

            CREATE TABLE IF NOT EXISTS attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                message_id TEXT NOT NULL,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                size INTEGER NOT NULL,
                data BLOB,
                FOREIGN KEY (message_id) REFERENCES messages (id)
            );

            CREATE TABLE IF NOT EXISTS blocked_keys (
                pub_key TEXT PRIMARY KEY
            );
            
            CREATE TABLE IF NOT EXISTS user_info (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pub_key TEXT UNIQUE NOT NULL,
                user_name TEXT,
                user_desc TEXT,
                avatar_name TEXT,
                avatar_type TEXT,
                avatar_size INTEGER,
                avatar_data BLOB
            );
            
            CREATE INDEX IF NOT EXISTS idx_messages_room_id ON messages (room_id);
            CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);
            CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON attachments (message_id);
            CREATE INDEX IF NOT EXISTS idx_user_info_pub_key ON user_info (pub_key);
        `);

        // Try to add the state column and ignore errors if it already exists
        // This is the cleanest way to do it, but SQLite doesn't support "IF NOT EXISTS" for ALTER TABLE
        try {
            await this.db.exec('ALTER TABLE messages ADD COLUMN state TEXT;');
        } 
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        catch (error) {
            // Column likely already exists, ignore the error
            console.log('State column might already exist, continuing...');
        }

        // I'm not skilled with SQLite, but followed the advice of Claude to add these two PRAGMAs.
        await this.db!.exec('PRAGMA journal_mode = WAL;');
        await this.db!.exec('PRAGMA busy_timeout = 5000;'); // 5 second timeout
    }

    checkDb = (): void => {
        if (!this.db) {
            console.trace();
            throw new Error('Database not initialized.');   
        }
    }

    get<T = any>(sql: any, ...params: any[]): Promise<T | undefined> {
        this.checkDb();
        return this.db!.get(sql, ...params);
    }

    all<T = any[]>(sql: any, ...params: any[]): Promise<T> {
        this.checkDb();
        return this.db!.all(sql, ...params);
    }

    run(sql: any, ...params: any[]): Promise<any> {
        this.checkDb();
        return this.db!.run(sql, ...params);
    }
}

export const dbMgr = new DBManager();

