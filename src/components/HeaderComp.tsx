import { useEffect, useState } from 'react';
import {app} from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faQuestionCircle, faScrewdriverWrench } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from './LogoBlockComp';
import { PageNames } from '../AppServiceTypes';
import { useGlobalState } from '../GlobalState';

declare const ADMIN_PUBLIC_KEY: string;

export default function HeaderComp() {
    const gs = useGlobalState();
    const [roomName, setRoomName] = useState('');
    
    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.roomName) {
            setRoomName(gs.roomName);
        }
    }, [gs.roomName]);

    let participantMsg = null;
    if (gs.connected) {
        if (gs.participants && gs.participants.size === 0) {
            participantMsg = `No one else is in this room.`;
        }
        else {
            participantMsg = `Members: You and ${gs.participants!.size} other${gs.participants!.size > 1 ? 's' : ''}`;
        }
    }
    else {
        if (gs.userName) {
            participantMsg = `Hi ${gs.userName}, Enter a room name and click Join.`;
        }
        else {
            participantMsg = 'You should go to the settings page to set your username.';
        }
    }
    
    return (
        <header className="app-header">
            <LogoBlockComp subText={participantMsg}/>
            <div className="flex items-center space-x-4">
                <div className="border border-gray-600 rounded px-3 py-1 bg-gray-700/50 flex items-center space-x-3">
                    {!gs.connected ? (
                        <>
                            <div className="flex items-center">
                                <label htmlFor="roomName" className="mr-2 text-gray-300">Room:</label>
                                <input 
                                    id="roomName"
                                    type="text" 
                                    value={roomName} 
                                    onChange={(e) => setRoomName(e.target.value)}
                                    className="input-field" 
                                />
                            </div>
                            
                            <button 
                                disabled={!gs.userName || !roomName}
                                onClick={() => app.connect(null, null, roomName)}
                                className="btn-green"
                            >
                                Join
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center">
                                <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" title="Connected"></div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-gray-300">User: <span className="text-blue-400 font-medium">{gs.userName}</span></span>
                                    <span className="text-sm text-gray-300">Room: <span className="text-purple-400 font-medium">{gs.roomName}</span></span>
                                </div>
                            </div>
                            <button 
                                onClick={app.disconnect}
                                className="btn-danger"
                            >
                                Leave
                            </button>
                            <button 
                                onClick={() => app.goToPage(PageNames.roomMembers)}
                                className="btn-secondary"
                            >
                                Info
                            </button>
                        </>
                    )}
                    <button 
                        onClick={() => app.goToPage(PageNames.rooms)}
                        className="btn-secondary"
                    >
                                Rooms
                    </button>
                </div>
                <button 
                    onClick={() => app.goToPage(PageNames.contacts)}
                    className="btn-secondary"
                >
                    Contacts
                </button>
                <button 
                    onClick={() => app.goToPage(PageNames.settings)}
                    className="btn-icon"
                    title="Settings"
                >
                    <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
                </button>
                { ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey &&
                <button 
                    onClick={() => app.goToPage(PageNames.admin)}
                    className="btn-icon"
                    title="Admin"
                >
                    <FontAwesomeIcon icon={faScrewdriverWrench} className="h-5 w-5" />
                </button>}
                <button 
                    onClick={() => app.goToPage(PageNames.userGuide)}
                    className="btn-icon"
                    title="Help"
                >
                    <FontAwesomeIcon icon={faQuestionCircle} className="h-5 w-5" />
                </button>
            </div>
        </header>
    );
};
