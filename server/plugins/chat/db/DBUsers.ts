import { FileBase64Intf, UserProfile } from "../../../../common/types/CommonTypes.js";
import { dbMgr } from "./DBManager.js";

/**
 * Database operations for managing user data.
 * Provides methods to handle user profiles, content moderation, and access control.
 */
class DBUsers {

    /**
     * Checks if a user is blocked in the system.
     * 
     * @param pub_key - The public key of the user to check
     * @returns A Promise resolving to true if the user is blocked, false otherwise
     */
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

    /**
     * Deletes all content (messages and attachments) associated with a user.
     * Useful for content moderation and user data removal requests.
     * 
     * @param pub_key - The public key of the user whose content should be deleted
     * @returns A Promise resolving to true if deletion was successful, false otherwise
     */
    deleteUserContent = async (pub_key: string): Promise<boolean> => {
        try {
            if (!pub_key) {
                console.error('Cannot delete content for an empty public key');
                return false;
            }

            // First delete all attachments associated with this user's messages
            await dbMgr.run(
                'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE public_key = ?)',
                [pub_key]
            );

            // Then delete all messages associated with the public key
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

    /**
     * Blocks a user by adding their public key to the blocked_keys table.
     * Uses INSERT OR IGNORE to prevent duplicates.
     * 
     * @param pub_key - The public key of the user to block
     * @returns A Promise that resolves when the operation is complete
     */
    blockUser = async (pub_key: string) => {
        try {
            if (!pub_key) {
                console.error('Cannot block an empty public key');
                return;
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

    /**
     * Saves or updates a user's profile information in the database.
     * Handles avatar binary data conversion from base64 encoding.
     * 
     * @param userProfile - The user profile object containing name, description, avatar, and public key
     * @returns A Promise resolving to true if the save operation was successful, false otherwise
     */
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
     * Retrieves a user's profile information from the database.
     * Converts binary avatar data back to a base64 data URL if available.
     * 
     * @param publicKey - The public key of the user to retrieve
     * @returns A Promise resolving to the user profile object or null if not found
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

/**
 * Singleton instance of the DBUsers class for managing user operations.
 */
export const dbUsers = new DBUsers();