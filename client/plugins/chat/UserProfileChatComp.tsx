import { useGlobalState } from './ChatTypes';
import { UserProfile } from '../../../common/types/CommonTypes';
import { addContact } from './Contacts';

interface UserProfileChatCompProps {
    profileData: UserProfile;
}

/**
 * Component that displays contact status and provides functionality to add users as contacts.
 * Shows whether a user is already in contacts or provides an "Add Contact" button.
 */
export default function UserProfileChatComp({ profileData }: UserProfileChatCompProps) {
    const gs = useGlobalState();
    
    // Ensure chatContacts exists
    if (!gs.chatContacts) {
        gs.chatContacts = [];
    }

    const isInContacts = gs.chatContacts.some((contact: any) => contact.publicKey === profileData.publicKey);

    return (
        <div className="mt-6">
            <div className="bg-gray-700 p-4 rounded-lg">
                {isInContacts ? (
                    <div className="flex items-center">
                        <span className="text-green-400 font-medium">
                            This user is in your contacts
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center flex-col sm:flex-row sm:justify-between">
                        <span className="text-gray-300 mb-2 sm:mb-0">
                            This user is not in your contacts
                        </span>
                        <button
                            onClick={() => addContact({
                                name: profileData.name || "Unnamed User",
                                publicKey: profileData.publicKey!
                            })}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors duration-200"
                        >
                            Add Contact
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}