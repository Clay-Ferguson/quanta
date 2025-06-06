import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import TitledPanelComp from '../components/TitledPanelComp';
import { httpClientUtil } from '../HttpClientUtil';
import { useEffect } from 'react';
import { util } from '../Util';

declare const ADMIN_PUBLIC_KEY: string;

/**
 * AdminPage component for managing server settings and test data.
 */
export default function AdminPage() {
    useEffect(() => util.resizeEffect(), []);
    
    if (!ADMIN_PUBLIC_KEY) {
        console.error('Admin public key is not set.');
        return null;
    }

    const createTestData = async () => {
        await httpClientUtil.secureHttpPost(`/api/admin/create-test-data`);
    };

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Admin"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>

            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">            
                <div className="space-y-6 max-w-2xl mx-auto">

                    <TitledPanelComp title="Manage Server">
                        {util.getPluginComponentsWrapped('getAdminPageComponent', 'admin-settings')}
                    </TitledPanelComp>

                    <TitledPanelComp title="Test Data">
                        <p className="text-gray-300 mb-4">
                            Restore test data, in room named 'test', for development and testing purposes. All existing data in the 'test' room will be deleted.
                        </p>
                        <button 
                            onClick={createTestData}
                            className="btn-secondary"
                        >
                            Create Test Data
                        </button>
                    </TitledPanelComp> 
                </div>
            </div>
        </div>
    );
}

