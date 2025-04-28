import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import RoomsAdminComp from '../components/RoomsAdminComp';

export default function RoomsAdminPage() {  
    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Manage Rooms"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
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
