import { crypt } from "@common/Crypto";
import { FileBase64Intf, KeyPairHex, UserProfile } from "@common/types/CommonTypes";
import { BlockUser_ReqInfo } from "@common/types/EndpointTypes";
import { app } from "./AppService";
import { DBKeys, PageNames } from "./AppServiceTypes";
import { alertModal } from "./components/AlertModalComp";
import { confirmModal } from "./components/ConfirmModalComp";
import { promptModal } from "./components/PromptModalComp";
import { gd, GlobalState, gs } from "./GlobalState";
import { httpClientUtil } from "./HttpClientUtil";
import { idb } from "./IndexedDB";

/**
 * AppUsers class manages user-related operations and data persistence in the Quanta Chat application.
 * 
 * This class provides functionality for:
 * - User profile management and display
 * - User information persistence to IndexedDB and server
 * - Cryptographic identity management (key pair generation and import)
 * - Contact management and user blocking operations
 * - User avatar and description handling
 * 
 * The class works closely with IndexedDB for client-side persistence and optionally
 * syncs user data with the server when `chatSaveToServer` mode is enabled. It also
 * integrates with the cryptographic system for identity verification and signing.
 */
class AppUsers {
    /**
     * Displays a user's profile page by setting the current page to userProfile.
     * 
     * This method navigates to the user profile page and initializes the profile
     * state with the provided public key. The profile data (name, description, avatar)
     * is initially empty and will be populated by other components or methods.
     * 
     * @param publicKey The public key of the user whose profile should be displayed
     */
    showUserProfile = async (publicKey: string) => {
        // set page to userprofile 
        const _gs = gs();
        app.setTopPage(_gs, PageNames.userProfile);
        _gs.displayUserProfile = {userId: null, name: '', publicKey, description: '', avatar: null};
        gd({ type: 'setUserProfile', payload: _gs});
    }

    /**
     * Saves user information to both local IndexedDB storage and optionally to the server.
     * 
     * This method performs a comprehensive save operation:
     * 1. Updates the global state with the new user information
     * 2. Persists the data to IndexedDB for offline access
     * 3. If `chatSaveToServer` is enabled and a key pair exists, sends the user profile to the server
     * 
     * The server sync allows for multi-device access and backup of user profile data.
     * 
     * @param userName The display name for the user
     * @param userDescription A description or bio text for the user
     * @param userAvatar The user's avatar image as a base64-encoded file interface, or null if no avatar
     */
    saveUserInfo = async (gs: GlobalState, userName: string, userDescription: string, userAvatar: FileBase64Intf | null): Promise<boolean> => {

        // Save user info to server if saving to server is enabled
        if (gs.keyPair?.publicKey) {
            const userProfile: UserProfile = {
                publicKey: gs.keyPair!.publicKey,
                name: userName,
                description: userDescription,
                avatar: userAvatar
            };
            const ret = await httpClientUtil.secureHttpPost<UserProfile, any>('/api/users/info', userProfile);
            if (ret && ret.user_id) {
                console.log("Success! User Info Saved to Server: ", JSON.stringify(ret, null, 2));

                gs.userProfile = {...gs.userProfile,
                    userId: ret.user_id,
                    name: userName,
                    description: userDescription,
                    avatar: userAvatar
                };
                
                await idb.setItem(DBKeys.userId, ret.user_id);
                await idb.setItem(DBKeys.userName, userName);
                await idb.setItem(DBKeys.userDescription, userDescription);
                await idb.setItem(DBKeys.userAvatar, userAvatar);
                   
                gd({ type: 'setUserProfile', payload: gs });
                return true;
            }  
        }
        return false;
    }

    /**
     * Imports a cryptographic key pair from a provided private key.
     * 
     * This method allows users to restore their identity by importing a private key.
     * The process includes:
     * 1. Confirmation check if an existing key pair would be overwritten
     * 2. Prompting the user for their private key
     * 3. Generating the corresponding public key from the private key
     * 4. Updating global state and persisting the key pair to IndexedDB
     * 
     * Key pairs are essential for message signing, verification, and user authentication
     * in the Quanta Chat cryptographic system.
     */
    importKeyPair = async () => {
        const _gs = gs();
        if (_gs.keyPair && _gs.keyPair!.publicKey && _gs.keyPair!.privateKey) {
            if (!await confirmModal("Are you sure? This will overwrite your existing key pair.")) {
                return;
            }
        }
        const privateKey = await promptModal("Enter Private Key");
        console.log("Importing Key Pair: " + privateKey);
        
        if (!privateKey) {
            return;
        }

        const keyPair = crypt.makeKeysFromPrivateKeyHex(privateKey);
        if (!keyPair) {
            console.error("Invalid private key provided.");
            return;
        }
        gd({ type: 'importIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.keyPair, keyPair);
    }

    /**
     * Creates a new cryptographic identity by generating a fresh key pair.
     * 
     * This method generates a new public/private key pair for the user's cryptographic
     * identity. The process includes:
     * 1. Optional confirmation check if an existing key pair would be overwritten
     * 2. Generating a new cryptographic key pair using the crypto library
     * 3. Updating global state with the new identity
     * 4. Persisting the key pair to IndexedDB for future sessions
     * 
     * Warning: This operation will overwrite any existing keys, so users should
     * back up their private key before proceeding.
     * 
     * @param askFirst Whether to show a confirmation modal before creating new keys (defaults to true)
     */
    createIdentity = async (askFirst: boolean = true) => {
        const _gs = gs();
        // if they already have a keyPair, ask if they want to create a new one
        if (askFirst && _gs.keyPair && _gs.keyPair!.publicKey && _gs.keyPair!.privateKey) {
            if (! await confirmModal("Create new Identity Keys?\n\nWARNING: This will overwrite your existing keys.")) {
                return;
            }
        }

        const keyPair: KeyPairHex= crypt.generateKeypair();
        gd({ type: 'creatIdentity', payload: { 
            keyPair
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(DBKeys.keyPair, keyPair);
    }

    /**
     * Blocks a user and deletes all their messages from the system.
     * 
     * This administrative function performs a comprehensive blocking operation:
     * 1. Shows a confirmation modal to prevent accidental blocking
     * 2. Sends a secure request to the server to block the user by their public key
     * 3. The server handles deletion of all messages from the blocked user
     * 4. Displays a success message upon completion
     * 
     * This is typically an admin-only operation for content moderation purposes.
     * 
     * @param publicKey The public key of the user to block and remove messages from
     */
    blockUser = async (publicKey: string) => {
        if (!await confirmModal("Are you sure? This will delete all messages from this user and block them.")) {
            return;
        }
            
        // Make the secure POST request with body
        const response = await httpClientUtil.secureHttpPost<BlockUser_ReqInfo, any>('/api/admin/block-user', {
            publicKey: publicKey.trim()
        });
        if (response) {
            await alertModal(`Success: ${response.message}`);
        }
    }   
}

/**
 * Singleton instance of the AppUsers class for managing user operations.
 * 
 * This exported instance provides a centralized interface for all user-related
 * operations throughout the application. Other modules can import and use this
 * instance to perform user management, identity operations, and contact handling.
 */
const appUsers = new AppUsers();
export default appUsers;