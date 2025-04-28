import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { crypt } from '../../common/Crypto';
import { useGlobalState } from '../GlobalState';
import { useState } from 'react';
import TitledPanel from '../components/TitledPanel';
import { app } from '../AppService';
import { PageNames } from '../AppServiceTypes';

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
        const success = await crypt.secureHttpPost(`/api/admin/create-test-data`, gs.keyPair!);
        if (success) {
            alert('Test data creation request submitted successfully! You will need to REFRESH the page to see the changes.');
        } else {
            alert(`Failed to create test data`);
        }
    };

    const getRoomInfo = async () => {
        setLoading(true);
        try {
            const response: any = await crypt.secureHttpPost(`/api/admin/get-room-info`, gs.keyPair!);
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

    const blockUser = async () => {
        const pubKey = prompt("Enter User Public Key to block:");
        if (!pubKey || pubKey.trim() === '') {
            alert("No public key provided");
            return;
        }

        app._blockUser(pubKey);
    }

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

                    <TitledPanel title="Server Data">
                        <button 
                            onClick={() => app.goToPage(PageNames.recentAttachments)}
                            className="btn-secondary"
                            title="Recent Attachments"
                        >
                            Recent Attachments
                        </button>
                    </TitledPanel>


                    <TitledPanel title="Test Data">
                        <p className="text-gray-300 mb-4">
                                Restore test data, in room named 'test', for development and testing purposes. All existing data in the 'test' room will be deleted.
                        </p>
                        <button 
                            onClick={createTestData}
                            className="btn-secondary"
                        >
                                Create Test Data
                        </button>
                    </TitledPanel> 

                    <TitledPanel title="All Rooms">
                        <p className="text-gray-300 mb-4">
                                View information about all rooms stored on the server.
                        </p>
                        <button 
                            onClick={getRoomInfo}
                            className="btn-secondary"
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Show All Rooms'}
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
                    </TitledPanel>

                    <TitledPanel title="Manage Users">
                        <button 
                            className="btn-secondary"
                            onClick={blockUser}
                        >
                            Block User
                        </button>
                    </TitledPanel>
                </div>
            </div>
        </div>
    );
}

