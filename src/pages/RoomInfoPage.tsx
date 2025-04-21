import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import RoomMembersComp from '../components/RoomMembersComp';
import TitledPanel from '../components/TitledPanel';
import { useGlobalState } from '../GlobalState';

export default function RoomInfoPage() {
    const { roomName = "" } = useGlobalState();
    
    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Room Info"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>
            <div id="roomMembers" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="roomMembersComp" className="space-y-3">
                    <h3  className="font-semibold">
                        Room: {roomName}
                    </h3>   
                    <TitledPanel title="Room Members">
                        <RoomMembersComp />
                    </TitledPanel>
                </div>
            </div>
        </div>
    );
}
