import { useState, useEffect } from 'react';
import { useGlobalState } from '../GlobalState';
import { crypt } from '../../common/Crypto';
import { app } from '../AppService';

// Define interface for room info
interface RoomInfo {
    id: string;
    name: string;
    messageCount: number;
}

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
                const response: any = await crypt.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
                if (response && Array.isArray(response.rooms)) {
                    setRoomsData(response.rooms);
                } else {
                    setError('Failed to retrieve room information');
                    app.alert('Failed to retrieve room information');
                }
            } catch (error) {
                console.error('Error fetching room info:', error);
                setError('An error occurred while fetching room information');
                app.alert('An error occurred while fetching room information');
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
            const response: any = await crypt.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
            if (response && Array.isArray(response.rooms)) {
                setRoomsData(response.rooms);
            } else {
                setError('Failed to retrieve room information');
                app.alert('Failed to retrieve room information');
            }
        } catch (error) {
            console.error('Error fetching room info:', error);
            setError('An error occurred while fetching room information');
            app.alert('An error occurred while fetching room information');
        } finally {
            setLoading(false);
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
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-200">Room ID</th>
                                <th className="px-4 py-2 text-left text-sm font-medium text-gray-200">Message Count</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {roomsData.map((room) => (
                                <tr key={room.id}>
                                    <td className="px-4 py-2 text-sm text-gray-300">{room.name}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{room.id}</td>
                                    <td className="px-4 py-2 text-sm text-gray-300">{room.messageCount}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </>
    );
}