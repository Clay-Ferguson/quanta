import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';

declare const ADMIN_PUBLIC_KEY: string;

export default function AdminPage() {
    if (!ADMIN_PUBLIC_KEY) {
        console.error('Admin public key is not set. Please set the QUANTA_CHAT_ADMIN_PUBLIC_KEY environment variable.');
        return null;
    }

    const createTestData = async () => {
        try {
            const response = await fetch('/api/admin/create-test-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ publicKey: ADMIN_PUBLIC_KEY }),
            });
            
            if (response.ok) {
                alert('Test data creation request submitted successfully! You will need to REFRESH the page to see the changes.');
            } else {
                alert('Failed to create test data');
            }
        } catch (error) {
            console.error('Error creating test data:', error);
            alert('An error occurred while creating test data');
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
                </div>
            </div>
        </div>
    );
}

