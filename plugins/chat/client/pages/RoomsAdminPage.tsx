import LogoBlockComp from '@client/components/LogoBlockComp';
import BackButtonComp from '@client/components/BackButtonComp';
import RoomsAdminComp from '../comps/RoomsAdminComp';
import { useEffect } from 'react';
import { util } from '@client/Util';

interface RoomsAdminPageProps {
    pluginTitle?: string;
}

/**
 * Page for managing rooms, including creating, deleting, and modifying room settings. For the admin user only.
 */
export default function RoomsAdminPage({ pluginTitle }: RoomsAdminPageProps) {  
    useEffect(() => util.resizeEffect(), []);
    
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Manage Rooms" pluginTitle={pluginTitle}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="roomsAdmin" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="roomsAdminComp" className="space-y-3">
                    <RoomsAdminComp/>
                </div>
            </div>
        </div>
    );
}
