import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import RoomMembersComp from '../components/RoomMembersComp';
import TitledPanelComp from '../components/TitledPanelComp';
import { useGlobalState } from '../GlobalState';
import { useEffect } from 'react';
import { util } from '../Util';

export default function RoomInfoPage() {
    const gs = useGlobalState();
    useEffect(() => util.resizeEffect(), []);
    
    if (!gs.roomName) {
        return null;
    }

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Room Info"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="roomInfo" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="roomInfoComp" className="space-y-3">
                    <h3 className="font-semibold">
                        Room: {gs.roomName}
                    </h3>   
                        
                    <TitledPanelComp title="In Room Now...">
                        <RoomMembersComp />
                    </TitledPanelComp>
                </div>
            </div>
        </div>
    );
}
