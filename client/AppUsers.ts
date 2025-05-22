import { crypt } from "../common/Crypto";
import { Contact, FileBase64Intf, KeyPairHex, User, UserProfile } from "../common/types/CommonTypes";
import { BlockUser_Request } from "../common/types/EndpointTypes";
import { app } from "./AppService";
import { DBKeys, PageNames } from "./AppServiceTypes";
import { alertModal } from "./components/AlertModalComp";
import { confirmModal } from "./components/ConfirmModalComp";
import { promptModal } from "./components/PromptModalComp";
import { gd, gs } from "./GlobalState";
import { httpClientUtil } from "./HttpClientUtil";
import { idb } from "./IndexedDB";

class AppUsers {
    showUserProfile = async (publicKey: string) => {
        // set page to userprofile 
        const _gs = gs();
        app.setTopPage(_gs, PageNames.userProfile);
        _gs.userProfile = {name: '', publicKey, description: '', avatar: null};
        gd({ type: 'setUserProfile', payload: _gs});
    }

    saveUserInfo = async (userName: string, userDescription: string, userAvatar: FileBase64Intf | null) => {
        const _gs = gd({ type: `setUserInfo`, payload: { 
            userName, userDescription, userAvatar
        }});
        await idb.setItem(DBKeys.userName, userName);
        await idb.setItem(DBKeys.userDescription, userDescription);
        await idb.setItem(DBKeys.userAvatar, userAvatar);

        // Save user info to server if saving to server is enabled
        if (_gs.saveToServer && _gs.keyPair?.publicKey) {
            const userProfile: UserProfile = {
                publicKey: _gs.keyPair!.publicKey,
                name: userName,
                description: userDescription,
                avatar: userAvatar
            };
            await httpClientUtil.secureHttpPost<UserProfile, any>('/api/users/info', userProfile);
        }
    }

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

    blockUser = async (publicKey: string) => {
        if (!await confirmModal("Are you sure? This will delete all messages from this user and block them.")) {
            return;
        }
            
        // Make the secure POST request with body
        const response = await httpClientUtil.secureHttpPost<BlockUser_Request, any>('/api/admin/block-user', {
            publicKey: publicKey.trim()
        });
        if (response) {
            await alertModal(`Success: ${response.message}`);
        }
    }
    
    addContact = async (user: User) => {
        const _gs = gs();
        if (!_gs.contacts) {
            console.warn('No contacts available to add a new contact');
            return;
        }
    
        // Check if the user is already in the contacts
        const existingContact = _gs.contacts!.find((contact: Contact) => contact.publicKey === user.publicKey);
        if (existingContact) {
            console.warn('User is already in contacts');
            return;
        }
    
        // Add the new contact
        _gs.contacts!.push({
            publicKey: user.publicKey,
            alias: user.name,
        });

        await idb.setItem(DBKeys.contacts, _gs.contacts);
        gd({ type: 'addContact', payload: _gs});
    }    
}

const appUsers = new AppUsers();
export default appUsers;