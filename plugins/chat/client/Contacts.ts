import { Contact, User } from "../../../common/types/CommonTypes";
import { DBKeys } from "../../../client/AppServiceTypes.ts";
import { idb } from "../../../client/IndexedDB";
import { gd, gs } from "./ChatTypes.ts"

/**
 * Adds a user to the current user's contact list.
 * 
 * This method manages the contact list by:
 * 1. Checking if a contacts list exists in the global state
 * 2. Verifying the user is not already in the contacts to prevent duplicates
 * 3. Adding the new contact with their public key and name as alias
 * 4. Persisting the updated contacts list to IndexedDB
 * 5. Updating the global state to reflect the changes
 * 
 * Contacts are used for easy access to frequently messaged users and for
 * cryptographic verification of known users.
 * 
 * @param user The user object containing name and publicKey to add to contacts
 */
export const addContact = async (user: User) => {
    const _gs = gs();

    if (!_gs.chatContacts) {
        console.warn('No contacts available to add a new contact');
        return;
    }
    
    // Check if the user is already in the contacts
    const existingContact = _gs.chatContacts!.find((contact: Contact) => contact.publicKey === user.publicKey);
    if (existingContact) {
        console.warn('User is already in contacts');
        return;
    }
    
    // Add the new contact
    _gs.chatContacts!.push({
        publicKey: user.publicKey,
        alias: user.name,
    });

    await idb.setItem(DBKeys.chatContacts, _gs.chatContacts);
    gd({ type: 'addContact', payload: _gs});
}    

