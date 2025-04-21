import { useGlobalState } from '../GlobalState';

export default function RoomMembersComp() {
    const { participants = [] } = useGlobalState();

    // Sort contacts alphabetically by name
    const sortedContacts = [...participants!].sort((a, b) => a.localeCompare(b));

    return (
        <div className="w-full">
            <div className="w-full overflow-x-auto border border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Name
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Alias
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

                        {sortedContacts.length > 0 ? (
                            sortedContacts.map((member) => (
                                <tr key={member} className="hover:bg-gray-750">
                                    <td className="px-3 py-2 whitespace-nowrap">{member}</td>
                                    <td className="px-3 py-2 whitespace-nowrap">TBD</td>
                                    <td className="px-3 py-2">
                                        TBD
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

