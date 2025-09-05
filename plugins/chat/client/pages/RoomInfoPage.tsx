import LogoBlockComp from '../../../../client/components/LogoBlockComp';
import BackButtonComp from '../../../../client/components/BackButtonComp';
import RoomMembersComp from '../comps/RoomMembersComp';
import TitledPanelComp from '../../../../client/components/TitledPanelComp';
import { useGlobalState } from '../ChatTypes';
import { useEffect } from 'react';
import { util } from '../../../../client/Util';

interface RoomInfoPageProps {
    pluginTitle?: string;
}

/**
 * Page for displaying information about the current chat room.
 * It shows the room name and a list of members currently in the room.
 */
export default function RoomInfoPage({ pluginTitle }: RoomInfoPageProps) {
    const gs = useGlobalState();
    useEffect(() => util.resizeEffect(), []);
    
    if (!gs.chatRoom) {
        return null;
    }

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Room Info" pluginTitle={pluginTitle}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="roomInfo" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="roomInfoComp" className="space-y-3">
                    <h3 className="font-semibold">
                        Room: {gs.chatRoom}
                    </h3>   
                        
                    <TitledPanelComp title="In Room Now...">
                        <RoomMembersComp />
                    </TitledPanelComp>
                </div>
            </div>
        </div>
    );
}
