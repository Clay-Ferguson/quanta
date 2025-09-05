import { useState, useEffect } from 'react';
import { useGlobalState } from '../ChatTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { httpClientUtil } from '../../../../client/HttpClientUtil';
import { DeleteRoom_Request, GetRoomInfo_Response } from '../../../../common/types/EndpointTypes';
import { alertModal } from '../../../../client/components/AlertModalComp';
import { confirmModal } from '../../../../client/components/ConfirmModalComp';
import appRooms from '../AppRooms';

// Define interface for room info
interface RoomInfo {
    id: string;
    name: string;
    messageCount: number;
}

/**
 * Displays a list of rooms and allows the admin to delete rooms.
 */
export default function RoomsAdminComp() {
    const gs = useGlobalState();
    const [roomsData, setRoomsData] = useState<RoomInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load rooms data on component mount
    useEffect(() => {
        const loadRoomsData = async () => {
            setError(null);
            
            try {
                setLoading(true);
                const response: GetRoomInfo_Response | null = await httpClientUtil.secureHttpPost<any, GetRoomInfo_Response>(`/api/admin/get-room-info`);
                if (response && Array.isArray(response.rooms)) {
                    setRoomsData(response.rooms);
                } else {
                    setError('Failed to retrieve room information');
                    await alertModal('Failed to retrieve room information');
                }
            } finally {
                setLoading(false);
            }
        };

        if (gs.keyPair) {
            loadRoomsData();
        } else {
            setError('No authentication key pair available');
        }
    }, [gs.keyPair]);

    const refreshRooms = async () => {
        setError(null);
        
        try {
            setLoading(true);
            const response: GetRoomInfo_Response | null = await httpClientUtil.secureHttpPost<any, GetRoomInfo_Response>(`/api/admin/get-room-info`);
            if (response && Array.isArray(response.rooms)) {
                setRoomsData(response.rooms);
            } else {
                setError('Failed to retrieve room information');
                await alertModal('Failed to retrieve room information');
            }
        } finally {
            setLoading(false);
        }
    };

    const deleteRoom = async (roomName: string) => {
        if (!await confirmModal(`Are you sure you want to delete the room "${roomName}"?`)) {
            return;
        }

        const res = await httpClientUtil.secureHttpPost<DeleteRoom_Request, any>(`/api/admin/delete-room`, {
            roomName
        });
            
        if (res) {
            // Remove the deleted room from the state
            setRoomsData(prevRooms => prevRooms.filter(room => room.name !== roomName));
            await alertModal(`Room "${roomName}" deleted successfully`);
        }
    };

    return (
        <>
            <div className="mb-4 flex justify-between items-center">
                <p className="text-gray-300">
                    Information about all rooms stored on the server.
                </p>
                <button 
                    onClick={refreshRooms}
                    className="btn-secondary"
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Refresh Rooms'}
                </button>
            </div>

            {error && (
                <div className="mb-4 p-3 bg-red-900 text-red-200 rounded-md">
                    {error}
                </div>
            )}
            
            {loading && roomsData.length === 0 && (
                <div className="text-center p-4">
                    <p className="text-gray-400">Loading rooms data...</p>
                </div>
            )}

            {!loading && roomsData.length === 0 && !error && (
                <div className="text-center p-4">
                    <p className="text-gray-400">No rooms found</p>
                </div>
            )}

            {roomsData.length > 0 && (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-gray-800 border border-gray-700 rounded-lg">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-200">Room Name</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-200">Message Count</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-200">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {roomsData.map((room) => (
                                <tr key={room.id}>
                                    <td className="px-4 py-2 text-sm text-gray-300">{room.name}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{room.messageCount}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">
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
                                            onClick={() => deleteRoom(room.name)}
                                            className="text-red-400 hover:text-red-300"
                                            title="Delete Room"
                                        >
                                            <FontAwesomeIcon icon={faTrash} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}