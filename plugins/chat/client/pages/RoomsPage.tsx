import LogoBlockComp from '../../../../client/components/LogoBlockComp';
import BackButtonComp from '../../../../client/components/BackButtonComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import TitledPanelComp from '../../../../client/components/TitledPanelComp';
import { useGlobalState } from '../ChatTypes';
import { RoomHistoryItem } from '../../../../client/AppServiceTypes';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { useEffect } from 'react';
import { util } from '../../../../client/Util';
import appRooms from '../AppRooms';

interface RoomsPageProps {
    pluginTitle?: string;
}

/**
 * Page for displaying the list of rooms the user has previously joined.
 */
export default function RoomsPage({ pluginTitle }: RoomsPageProps) {
    const gs = useGlobalState();
    useEffect(() => util.resizeEffect(), []);
    
    if (!gs.chatRoomHistory) {
        return <div className="text-center text-gray-400">No room history.</div>;
    }

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Rooms" pluginTitle={pluginTitle}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="rooms" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="roomsComp" className="space-y-3">
                    <TitledPanelComp title="Room History">
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <div className="mb-2">
                                <p className="text-xs text-gray-400 mt-1">
                                                       List of rooms you've previously joined. Click the trash icon to remove a room from history.
                                </p>
                            </div>
                            {gs.chatRoomHistory!.length > 0 ? (
                                <div className="mt-3 overflow-x-auto">
                                    <table className="min-w-full divide-y divide-blue-400/20">
                                        <thead className="bg-gray-900/50">
                                            <tr>
                                                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-blue-300 uppercase tracking-wider">
                                                    Room Name
                                                </th>
                                                <th scope="col" className="px-4 py-2 text-right text-xs font-medium text-blue-300 uppercase tracking-wider">
                                                    Action
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-gray-800 divide-y divide-blue-400/10">
                                            {gs.chatRoomHistory!.map((room: RoomHistoryItem, index) => (
                                                <tr key={index} className="hover:bg-gray-700/50">
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-200 font-mono">
                                                        {room.name}
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-right">
                                                        {gs.chatRoom===room.name && gs.chatConnected ? (
                                                            <button 
                                                                onClick={appRooms.disconnect}
                                                                className="btn-danger mr-2"
                                                            >
                                                           Leave
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                onClick={() => appRooms.connect(null, null, room.name)}
                                                                className="btn-green mr-2"
                                                                aria-label={`Join ${room.name}`}
                                                            >
                                                           Join
                                                            </button>)}
                                                        <button 
                                                            onClick={() => appRooms.forgetRoom(room.name)}
                                                            className="text-red-400 hover:text-red-300 focus:outline-none"
                                                            aria-label={`Delete ${room.name}`}
                                                        >
                                                            <FontAwesomeIcon icon={faTrash} className="h-4 w-4" />
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-4 text-gray-400 text-sm italic">
                                                       No room history found
                                </div>
                            )}
                        </div>
                    </TitledPanelComp>
                </div>
            </div>
        </div>
    );
}
