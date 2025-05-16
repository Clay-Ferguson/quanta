import { FileBase64Intf, UserProfile } from "../../common/CommonTypes.js";
import { dbMgr } from "./DBManager.js";

class DBUsers {

    public async isUserBlocked(pub_key: string): Promise<boolean> {
        try {
            if (!pub_key) {
                return false; // Can't check an empty key
            }
        
            const result = await dbMgr.get(
                'SELECT pub_key FROM blocked_keys WHERE pub_key = ?',
                [pub_key]
            );
        
            return !!result; // Convert to boolean - true if found, false if not found
        } catch (error) {
            console.error('Error checking if user is blocked:', error);
            return false; // Default to not blocked on error
        }
    }

    deleteUserContent = async (pub_key: string): Promise<boolean> => {
        try {
            if (!pub_key) {
                console.error('Cannot delete content for an empty public key');
                return false;
            }

            await dbMgr.run(
                'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE public_key = ?)',
                [pub_key]
            );

            // Delete messages and attachments associated with the public key
            await dbMgr.run(
                'DELETE FROM messages WHERE public_key = ?',
                [pub_key]
            );
        
            console.log(`Deleted content for public key: ${pub_key}`);
            return true;
        } catch (error) {
            console.error('Error deleting user content:', error);
            return false;
        }
    }

    blockUser = async (pub_key: string) => {
        try {
            if (!pub_key) {
                console.error('Cannot block an empty public key');
            }
        
            // Use INSERT OR IGNORE to avoid errors if the key is already blocked
            await dbMgr.run(
                'INSERT OR IGNORE INTO blocked_keys (pub_key) VALUES (?)',
                [pub_key]
            );
            console.log(`Public key blocked: ${pub_key}`);
        } catch (error) {
            console.error('Error blocking user:', error);
        }
    }

    saveUserInfo = async (userProfile: UserProfile): Promise<boolean> => {
        try {
            if (!userProfile.publicKey) {
                console.error('Cannot save user info without a public key');
                return false;
            }
            let avatarBinaryData: Buffer | null = null;
        
            // Extract binary data from data URL if avatar exists
            if (userProfile.avatar && userProfile.avatar.data) {
                const matches = userProfile.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    avatarBinaryData = Buffer.from(matches[2], 'base64');
                }
            }

            // Use INSERT OR REPLACE to handle both insert and update cases
            await dbMgr.run(
                `INSERT OR REPLACE INTO user_info 
            (pub_key, user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userProfile.publicKey,
                    userProfile.name,
                    userProfile.description,
                    userProfile.avatar?.name || null,
                    userProfile.avatar?.type || null,
                    userProfile.avatar?.size || null,
                    avatarBinaryData
                ]
            );
            console.log(`User info saved for public key: ${userProfile.publicKey}`);
            return true;
        } catch (error) {
            console.error('Error saving user info:', error);
            return false;
        }
    }

    /**
     * Retrieves user information from the database
     * @param publicKey The user's public key
     * @returns The user information or null if not found
     */
    getUserInfo = async (publicKey: string): Promise<UserProfile | null> => {
        try {
            if (!publicKey) {
                console.error('Cannot get user info without a public key');
                return null;
            }

            const userInfo = await dbMgr.get(
                `SELECT user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data 
             FROM user_info 
             WHERE pub_key = ?`,
                [publicKey]
            );

            if (!userInfo) {
                return null;
            }

            // Convert binary avatar data back to data URL if it exists
            let avatar: FileBase64Intf | null = null;
            if (userInfo.avatar_data) {
                avatar = {
                    name: userInfo.avatar_name,
                    type: userInfo.avatar_type,
                    size: userInfo.avatar_size,
                    data: `data:${userInfo.avatar_type};base64,${Buffer.from(userInfo.avatar_data).toString('base64')}`
                };
            }

            const userProfile: UserProfile = {
                name: userInfo.user_name,
                description: userInfo.user_desc,
                avatar,
                publicKey
            };
            return userProfile;
        } catch (error) {
            console.error('Error retrieving user info:', error);
            return null;
        }
    }
}

export const dbUsers = new DBUsers();