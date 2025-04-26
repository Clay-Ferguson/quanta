import { Contact } from '../AppServiceTypes';
import { useGlobalState } from '../GlobalState';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUser } from '@fortawesome/free-solid-svg-icons';
import { util } from '../Util';

export default function RoomMembersComp() {
    const gs = useGlobalState();
    // get 'participants' which is a type of Map<string, User> | null
    const { participants, contacts } = useGlobalState();

    // Sort contacts alphabetically by name
    const sortedParticipants: any[] = participants ? Array.from(participants.values()).sort((a, b) => a.name.localeCompare(b.name)) : [];

    // let's add ourselves as the first member in the list
    if (gs.keyPair && gs.userName) {
        sortedParticipants.unshift({
            publicKey: gs.keyPair.publicKey,
            name: gs.userName,
            avatar: gs.userAvatar ? gs.userAvatar.data : null
        });
    }
    
    if (contacts) {
        // scan all sorted participants and for each one that's a known contact (looked up by public key) add a property 'alias' to it for display below.
        for (const member of sortedParticipants) {;
            const contact = contacts.find((contact: Contact) => contact.publicKey === member.publicKey);
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
                                            <img 
                                                src={`/api/users/${encodeURIComponent(member.publicKey)}/avatar`} 
                                                alt={`${member.name}'s avatar`} 
                                                className="w-10 h-10 rounded-full object-cover border border-gray-600"
                                                onError={util.onAvatarError}
                                            />
                                            <div className="w-10 h-10 bg-gray-700 rounded-full items-center justify-center hidden">
                                                <FontAwesomeIcon icon={faUser} className="text-gray-400 text-lg" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap">{member.alias || ''}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">{member.name}</td>
                                    <td className="px-3 py-2">
                                        <div className="flex items-center">
                                            <span className="font-mono text-sm truncate max-w-[200px]" title={member.publicKey}>
                                                {member.publicKey.length > 20
                                                    ? `${member.publicKey.substring(0, 10)}...${member.publicKey.substring(member.publicKey.length - 10)}`
                                                    : member.publicKey}
                                            </span>
                                            <button 
                                                className="ml-2 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded"
                                                onClick={() => navigator.clipboard.writeText(member.publicKey)}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                        TBD
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

