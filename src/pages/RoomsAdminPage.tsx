import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import RoomsAdminComp from '../components/RoomsAdminComp';
import { useEffect } from 'react';
import { util } from '../Util';

export default function RoomsAdminPage() {  
    useEffect(() => util.resizeEffect(), []);
    
    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Manage Rooms"/>
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
