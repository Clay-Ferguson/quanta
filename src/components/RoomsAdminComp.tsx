import { useState, useEffect } from 'react';
import { useGlobalState } from '../GlobalState';
import { app } from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash } from '@fortawesome/free-solid-svg-icons';
import { httpClientUtil } from '../HttpClientUtil';
import { GetRoomInfo_Response } from '../../common/CommonTypes';

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
            setLoading(true);
            setError(null);
            
            try {
                const response: GetRoomInfo_Response = await httpClientUtil.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
                if (response && Array.isArray(response.rooms)) {
                    setRoomsData(response.rooms);
                } else {
                    setError('Failed to retrieve room information');
                    await app.alert('Failed to retrieve room information');
                }
            } catch (error) {
                console.error('Error fetching room info:', error);
                setError('An error occurred while fetching room information');
                await app.alert('An error occurred while fetching room information');
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
        setLoading(true);
        setError(null);
        
        try {
            const response: GetRoomInfo_Response = await httpClientUtil.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
            if (response && Array.isArray(response.rooms)) {
                setRoomsData(response.rooms);
            } else {
                setError('Failed to retrieve room information');
                await app.alert('Failed to retrieve room information');
            }
        } catch (error) {
            console.error('Error fetching room info:', error);
            setError('An error occurred while fetching room information');
            await app.alert('An error occurred while fetching room information');
        } finally {
            setLoading(false);
        }
    };

    const deleteRoom = async (roomName: string) => {
        if (!await app.confirm(`Are you sure you want to delete the room "${roomName}"?`)) {
            return;
        }

        try {
            await httpClientUtil.secureHttpPost(`/api/admin/delete-room`, gs.keyPair!, {
                roomName
            });
            
            // Remove the deleted room from the state
            setRoomsData(prevRooms => prevRooms.filter(room => room.name !== roomName));
            await app.alert(`Room "${roomName}" deleted successfully`);
        } catch (error) {
            console.error('Error deleting room:', error);
            await app.alert(`An error occurred while deleting room "${roomName}"`);
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
                                        {gs.roomName===room.name && gs.connected ? (
                                            <button 
                                                onClick={app.disconnect}
                                                className="btn-danger mr-2"
                                            >
                                                           Leave
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => app.connect(null, null, room.name)}
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