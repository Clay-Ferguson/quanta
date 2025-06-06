import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import TitledPanelComp from '../components/TitledPanelComp';
import { app } from '../AppService';
import { httpClientUtil } from '../HttpClientUtil';
import { useEffect } from 'react';
import { util } from '../Util';
import { promptModal } from '../components/PromptModalComp';
import appUsers from '../AppUsers';

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

    const getRoomInfo = async () => {
        // todo-0: this needs to come from an enum AND from the plugin, we can't have this here.
        app.goToPage('RoomsAdminPage');
    };

    const blockUser = async () => {
        const pubKey = await promptModal("Enter User Public Key to block");
        if (!pubKey || pubKey.trim() === '') {
            return;
        }

        appUsers.blockUser(pubKey);
    }

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
                        {/* 
                        todo-0: this will have to be implemented in a plugin-compatable way. see getPluginComponents in other files.
                                (also when doing this the getRoomInfo button below can be include)
                        <button 
                            onClick={() => app.goToPage(PageNames.recentAttachments)}
                            className="btn-secondary mr-2"
                            title="Recent Attachments"
                        >
                            Recent Attachments
                        </button> */}

                        <button 
                            onClick={getRoomInfo}
                            className="btn-secondary mr-2"
                        >
                            Server Rooms
                        </button>

                        <button 
                            className="btn-secondary mr-2"
                            onClick={blockUser}
                        >
                            Block User
                        </button>
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

