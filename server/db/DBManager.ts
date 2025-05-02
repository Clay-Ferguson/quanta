import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { dbRoom } from './DBRoom.js'; // Import the dbRoom module

// NOTE: In Node.js (non-bundled ESM) we use ".js" extension for imports. 
// This is correct. The "@common" folder is an alias so we can get access to 
// the common folder one level above the server folder (see tsconfig.json).
import {DBManagerIntf} from '@common/CommonTypes.js';
import { dbMessages } from './DBMessages.js';
import { dbAttachments } from './DBAttachments.js';
import { dbUsers } from './DBUsers.js';

export class DBManager implements DBManagerIntf {
    private db: Database | null = null;
    private static instance: DBManager | null = null;
    private dbPath: string;
    private tranCounter = 0;

    private constructor(dbPath: string) {
        this.dbPath = dbPath;
    }

    public static async getInstance(dbPath: string): Promise<DBManager> {
        console.log('DBManager.getInstance', dbPath);
        if (!DBManager.instance) {
            DBManager.instance = new DBManager(dbPath);
            await DBManager.instance.initialize();
        }
        return DBManager.instance;
    }

    private async initialize(): Promise<void> {
        // Ensure data directory exists
        const dbDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }

        // Open and initialize the database
        console.log('Opening database:', this.dbPath);
        this.db = await open({
            filename: this.dbPath,
            driver: sqlite3.Database
        });

        if (!this.db) {
            throw new Error('Failed to open database: ' + this.dbPath);
        }

        dbRoom.dbm = this;
        dbMessages.dbm = this; 
        dbAttachments.dbm = this; 
        dbUsers.dbm = this;

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

        // I'm not skilled with SQLite, but followed the advice of Claude to add these two PRAGMAs.
        await this.db!.exec('PRAGMA journal_mode = WAL;');
        await this.db!.exec('PRAGMA busy_timeout = 5000;'); // 5 second timeout
    }

    checkDb = (): void => {
        if (!this.db) {
            console.trace();
            throw new Error('Database not initialized. Call getInstance() first.');   
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

    runTrans = async (fn: () => Promise<any>): Promise<any> => {
        this.checkDb();
        let ret = null;
        
        // Increment counter BEFORE starting transaction
        this.tranCounter++;
        try {
            if (this.tranCounter > 1) {
                console.log('USING CURRENT TRAN');
                return await fn();
            }
            
            await this.db!.run('BEGIN TRANSACTION');
            ret = await fn();
            await this.db!.run('COMMIT');
        } catch (error) {
            console.error('Transaction error:', error);
            console.trace();
            if (this.tranCounter === 1) { // Only rollback if we're the "owner" of the transaction
                try {
                    await this.db!.run('ROLLBACK');
                } 
                catch (rollbackError) {
                    console.error('Transaction error:', rollbackError);
                }
            }
        }
        finally {
            this.tranCounter--;
        }
        return ret;
    }
}

