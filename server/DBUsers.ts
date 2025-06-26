import { FileBase64Intf, UserProfile, UserProfileCompact } from "../common/types/CommonTypes.js";
import pgdb from "./PGDB.js";
import { Request, Response } from 'express';
import { svrUtil } from "./ServerUtil.js";
import { config } from "./Config.js";

/**
 * Database operations for managing user data.
 * Provides methods to handle user profiles, content moderation, and access control.
 */
class DBUsers {
    /**
     * Saves or updates user profile information in the database
     * @param req - Express request object containing UserProfile in body
     * @param res - Express response object
     */
    saveUserProfile = async (req: Request<any, any, UserProfile>, res: Response): Promise<void> => {
        try {
            const userProfile: UserProfile = req.body;
            if (!userProfile.publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
            const success = await this.saveUserInfo(userProfile); 
            if (success) {
                res.json({ success: true });
            } else {
                res.status(500).json({ error: 'Failed to save user information' });
            }
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to save user profile');
        }
    }

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
        
            const result = await pgdb.get(
                'SELECT pub_key FROM blocked_keys WHERE pub_key = $1',
                pub_key
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
            await pgdb.query(
                'DELETE FROM attachments WHERE message_id IN (SELECT id FROM messages WHERE public_key = $1)',
                pub_key
            );

            // Then delete all messages associated with the public key
            await pgdb.query(
                'DELETE FROM messages WHERE public_key = $1',
                pub_key
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
        
            // Use INSERT ON CONFLICT DO NOTHING to avoid errors if the key is already blocked
            await pgdb.query(
                'INSERT INTO blocked_keys (pub_key) VALUES ($1) ON CONFLICT (pub_key) DO NOTHING',
                pub_key
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
            const adminPubKey = config.get("adminPublicKey");
            if (userProfile.publicKey.trim() === adminPubKey) {
                if (userProfile.name !== 'admin') {
                    throw new Error('Cannot change admin user name.');
                }
            }

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

            // Use INSERT ON CONFLICT DO UPDATE to handle both insert and update cases
            await pgdb.query(
                `INSERT INTO user_info 
            (pub_key, user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (pub_key) DO UPDATE SET
                user_name = EXCLUDED.user_name,
                user_desc = EXCLUDED.user_desc,
                avatar_name = EXCLUDED.avatar_name,
                avatar_type = EXCLUDED.avatar_type,
                avatar_size = EXCLUDED.avatar_size,
                avatar_data = EXCLUDED.avatar_data`,
                userProfile.publicKey,
                userProfile.name,
                userProfile.description,
                userProfile.avatar?.name || null,
                userProfile.avatar?.type || null,
                userProfile.avatar?.size || null,
                avatarBinaryData
            );

            if (userProfile) {
                const confirmUserProfile: UserProfileCompact | null = await this.getUserProfileCompact(userProfile.publicKey);
                if (confirmUserProfile) { 
                    await svrUtil.onCreateNewUser(confirmUserProfile);
                }
            }
            console.log(`User info saved for public key: ${userProfile.publicKey}`);
            return true;
        } catch (error) {
            console.error('Error saving user info:', error);
            return false;
        }
    }

    /**
     * Serves user avatar images by public key, returning the binary image data
     * @param req - Express request object containing pubKey in params
     * @param res - Express response object
     */
    serveAvatar = async (req: Request<{ pubKey: string }>, res: Response): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
                
            // Get user info from the database
            const userProfile: UserProfile | null = await dbUsers.getUserProfile(publicKey);
            if (!userProfile || !userProfile.avatar || !userProfile.avatar.data) {
                // Return a 404 for missing avatars
                res.status(404).send('Avatar not found');
                return;
            }
                
            // Extract content type and base64 data
            const matches = userProfile.avatar.data.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                res.status(400).send('Invalid avatar data format');
                return;
            }
                
            const contentType = matches[1];
            const base64Data = matches[2];
            const binaryData = Buffer.from(base64Data, 'base64');
                
            // Set appropriate headers
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Length', binaryData.length);
            res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day
                
            // Send the binary image data
            res.send(binaryData);
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to retrieve avatar');
        }
    }    

    /**
     * Retrieves user profile information by public key
     * @param req - Express request object containing pubKey in params
     * @param res - Express response object
     */
    getUserProfileReq = async (req: Request<{ pubKey: string }>, res: Response): Promise<void> => {
        try {
            const publicKey = req.params.pubKey;
            if (!publicKey) {
                res.status(400).json({ error: 'Public key is required' });
                return;
            }
            const userProfile: UserProfile | null = await dbUsers.getUserProfile(publicKey);
            if (userProfile) {
                res.json(userProfile);
            } else {
                res.status(404).json({ error: 'User information not found' });
            }
        } catch (error) {
            svrUtil.handleError(error, res, 'Failed to retrieve user profile');
        }
    }

    /**
     * Retrieves a subset of user's profile information from the database.
     * 
     * @param publicKey - The public key of the user to retrieve
     * @returns A Promise resolving to the user profile object or null if not found
     */
    getUserProfileCompact = async (publicKey: string): Promise<UserProfileCompact | null> => {
        try {
            if (!publicKey) {
                console.error('Cannot get user info without a public key');
                return null;
            }

            const userInfo = await pgdb.get(
                `SELECT id, user_name, pub_key
             FROM user_info 
             WHERE pub_key = $1`,
                publicKey
            );

            if (!userInfo) {
                return null;
            }

            const userProfile: UserProfileCompact = {
                id: userInfo.id,
                name: userInfo.user_name,
                publicKey
            };
            // do a json pretty print of the userProfile
            // console.log('User profile compact:', JSON.stringify(userProfile, null, 2));
            return userProfile;
        } catch (error) {
            console.error('Error retrieving user info:', error);
            return null;
        }
    }

    /**
     * Retrieves a user's profile information from the database.
     * Converts binary avatar data back to a base64 data URL if available.
     * 
     * @param publicKey - The public key of the user to retrieve
     * @returns A Promise resolving to the user profile object or null if not found
     */
    getUserProfile = async (publicKey: string): Promise<UserProfile | null> => {
        try {
            if (!publicKey) {
                console.error('Cannot get user info without a public key');
                return null;
            }

            const userInfo = await pgdb.get(
                `SELECT id, user_name, user_desc, avatar_name, avatar_type, avatar_size, avatar_data 
             FROM user_info 
             WHERE pub_key = $1`,
                publicKey
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
                id: userInfo.id,
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