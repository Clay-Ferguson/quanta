import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { crypto } from '../../common/Crypto';
import { useGlobalState } from '../GlobalState';
import { useState } from 'react';

declare const ADMIN_PUBLIC_KEY: string;

// Define an interface for the room info
interface RoomInfo {
    id: string;
    name: string;
    messageCount: number;
}

export default function AdminPage() {
    const gs = useGlobalState();
    const [roomsData, setRoomsData] = useState<RoomInfo[]>([]);
    const [loading, setLoading] = useState(false);
    
    if (!ADMIN_PUBLIC_KEY) {
        console.error('Admin public key is not set. Please set the QUANTA_CHAT_ADMIN_PUBLIC_KEY environment variable.');
        return null;
    }

    const createTestData = async () => {
        const success = await crypto.secureHttpPost(`/api/admin/create-test-data`, gs.keyPair!);
        if (success) {
            alert('Test data creation request submitted successfully! You will need to REFRESH the page to see the changes.');
        } else {
            alert(`Failed to create test data`);
        }
    };

    const getRoomInfo = async () => {
        setLoading(true);
        try {
            const response: any = await crypto.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
            if (response && Array.isArray(response.rooms)) {
                setRoomsData(response.rooms);
            } else {
                alert('Failed to retrieve room information');
            }
        } catch (error) {
            console.error('Error fetching room info:', error);
            alert('An error occurred while fetching room information');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Admin"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">            
                <div className="space-y-6 max-w-2xl mx-auto">
                    {/* Test Data Section */}
                    <div className="border border-blue-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2 mb-4">Test Data</h3>
                        
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <p className="text-gray-300 mb-4">
                                Restore test data, in room named 'test', for development and testing purposes. All existing data in the 'test' room will be deleted.
                            </p>
                            <button 
                                onClick={createTestData}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                            >
                                Create Test Data
                            </button>
                        </div>
                    </div>

                    {/* All Rooms Section todo-0: Make this room info table a component */}
                    <div className="border border-blue-400/30 rounded-lg p-4">
                        <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2 mb-4">All Rooms</h3>
                        
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                            <p className="text-gray-300 mb-4">
                                View information about all rooms stored on the server.
                            </p>
                            <button 
                                onClick={getRoomInfo}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md mb-4"
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Get Room Info'}
                            </button>

                            {roomsData.length > 0 && (
                                <div className="mt-4 overflow-x-auto">
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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

