import { useGlobalState } from '../ChatTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserPlus } from '@fortawesome/free-solid-svg-icons';
import HexKeyComp from '../../../../client/components/HexKeyComp';
import AvatarImageComp from '../../../../client/components/AvatarImageComp';
import { Contact } from '../../../../common/types/CommonTypes';
import { alertModal } from '../../../../client/components/AlertModalComp';
import { addContact } from '../Contacts';

/**
 * Displays the list of members in the room. This includes the user themselves, and all other participants.
 */
export default function RoomMembersComp() {
    const gs = useGlobalState();

    // Sort contacts alphabetically by name
    const sortedParticipants: any[] = gs.chatParticipants ? Array.from(gs.chatParticipants.values()).sort((a, b) => a.name.localeCompare(b.name)) : [];

    // let's add ourselves as the first member in the list
    if (gs.keyPair && gs.userProfile!.name) {
        sortedParticipants.unshift({
            publicKey: gs.keyPair.publicKey,
            name: gs.userProfile!.name,
            avatar: gs.userProfile?.avatar ? gs.userProfile.avatar.data : null
        });
    }
    
    if (gs.chatContacts) {
        // scan all sorted participants and for each one that's a known contact (looked up by public key) add a property 'alias' to it for display below.
        for (const member of sortedParticipants) {;
            const contact = gs.chatContacts.find((contact: Contact) => contact.publicKey === member.publicKey);
            if (contact) {
                member.alias = contact.alias;
            }
        }
    }
    
    return (
        <div className="w-full">
            <div className="w-full overflow-x-auto border border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Avatar
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Alias
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Name
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Public Key
                            </th>
                            <th scope="col" className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">

                        {sortedParticipants.length > 0 ? (
                            sortedParticipants.map((member: any) => (
                                <tr key={member.publicKey} className="hover:bg-gray-750">
                                    <td className="px-3 py-2 whitespace-nowrap">
                                        <div className="flex-shrink-0">
                                            <AvatarImageComp
                                                publicKey={member.publicKey}
                                                name={member.name || ''}
                                            />
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{member.alias || ''}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{member.name}</td>
                                    <td className="px-3 py-2">
                                        <HexKeyComp hexKey={member.publicKey} />
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                        {!member.alias && member.publicKey !== gs.keyPair?.publicKey ? (
                                            <button 
                                                className="text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded flex items-center"
                                                onClick={async () => {
                                                    addContact(member);
                                                    await alertModal(`Added ${member.name} to contacts`);
                                                }}
                                                title="Add to contacts"
                                            >
                                                <FontAwesomeIcon icon={faUserPlus} className="mr-1" />
                                                Add
                                            </button>
                                        ) : (
                                            <span className="text-xs text-gray-500">
                                                {member.alias ? "In Contacts" : "You"}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            
                            <tr>
                                <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                                    No one else in room.
                                </td>
                            </tr>                            
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

