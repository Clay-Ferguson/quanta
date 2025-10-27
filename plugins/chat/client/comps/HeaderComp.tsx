import { useEffect, useState } from 'react';
import {app} from '@client/AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faQuestionCircle, faScrewdriverWrench, faUsers, faChevronUp, faChevronDown  } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '@client/components/LogoBlockComp';
import { DBKeys, PageNames } from '@client/AppServiceTypes';
import { ChatPageNames, gd, gs, useGlobalState } from '../ChatTypes';
import { idb } from '@client/IndexedDB';
import appRooms from '../AppRooms';

declare const ADMIN_PUBLIC_KEY: string;

function toggleHeaderExpand() {
    let _gs = gs();
    _gs.headerExpanded = !_gs.headerExpanded;
    _gs = gd({ type: 'toggleHeaderExpand', payload: _gs});
    idb.setItem(DBKeys.headerExpanded, _gs.headerExpanded);
}

interface HeaderCompProps {
    pluginTitle?: string;
}

/**
 * Header component for the chat application. It includes a logo, room name input, and buttons for joining/leaving rooms.
 */
export default function HeaderComp({ pluginTitle }: HeaderCompProps) {
    const gs = useGlobalState();
    const [roomName, setRoomName] = useState('');
    
    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.chatRoom) {
            setRoomName(gs.chatRoom);
        }
    }, [gs.chatRoom]);
    
    return (
        <header className={`app-header flex flex-col md:flex-row md:items-center p-1 gap-3`}>
            
            {gs.headerExpanded && 
             <LogoBlockComp clazz="flex-shrink-0 mb-2 md:mb-0" 
                 subText={!gs.chatConnected && gs.userProfile!.name ? `Hi ${gs.userProfile!.name}` : ''}
                 pluginTitle={pluginTitle}
             />}
            
            <div className="flex flex-col lg:flex-row w-full gap-3">
                
                <div className="flex-grow">
                    {gs.headerExpanded && 
                        <div id="roomSection" className="border border-gray-600 pl-2 rounded bg-gray-700/50 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-fit">
                            {!gs.chatConnected ? (
                                <>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
                                        <label htmlFor="roomName" className="text-gray-300">Room:</label>
                                        <input 
                                            id="roomName"
                                            type="text" 
                                            value={roomName} 
                                            onChange={(e) => setRoomName(e.target.value)}
                                            className="input-field w-full sm:w-auto" 
                                        />
                                    </div>
                                
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            disabled={!gs.userProfile!.name || !roomName}
                                            onClick={() => appRooms.connect(null, null, roomName)}
                                            className="btn-green w-full sm:w-auto"
                                        >
                                        Join
                                        </button>
                                    
                                        <button 
                                            onClick={() => app.goToPage(ChatPageNames.rooms)}
                                            className="btn-secondary w-full sm:w-auto"
                                        >
                                        Rooms
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex flex-col w-full sm:w-auto">
                                        <span className="text-sm text-gray-300">User: <span className="text-blue-400 font-medium">{gs.userProfile!.name}</span></span>
                                        <span className="text-sm text-gray-300">Room: <span className="text-purple-400 font-medium">{`${gs.chatRoom} (${gs.chatParticipants!.size} others)`}</span></span>
                                    </div>
                                
                                    <div className="flex gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={appRooms.disconnect}
                                            className="btn-danger w-full sm:w-auto"
                                        >
                                        Leave
                                        </button>
                                        <button 
                                            onClick={() => app.goToPage(ChatPageNames.roomMembers)}
                                            className="btn-secondary w-full sm:w-auto"
                                        >
                                        Info
                                        </button>
                                        <button 
                                            onClick={() => app.goToPage(ChatPageNames.rooms)}
                                            className="btn-secondary w-full sm:w-auto"
                                        >
                                        Rooms
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    }
                </div>

                <div id="chatButtonBar" className="flex flex-wrap justify-center lg:justify-end gap-2 lg:gap-4 w-full lg:w-auto lg:flex-shrink-0">
                    {gs.headerExpanded && <button 
                        onClick={() => app.goToPage(PageNames.contacts)}
                        className="btn-icon"
                    >
                        <FontAwesomeIcon icon={faUsers} className="h-5 w-5" />
                    </button>}
                    {gs.headerExpanded && <button 
                        onClick={() => app.goToPage(PageNames.settings)}
                        className="btn-icon"
                        title="Settings"
                    >
                        <FontAwesomeIcon icon={faGear} className="h-5 w-5" />
                    </button>}
                    { gs.headerExpanded && ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey &&
                    <button 
                        onClick={() => app.goToPage(PageNames.admin)}
                        className="btn-icon"
                        title="Admin"
                    >
                        <FontAwesomeIcon icon={faScrewdriverWrench} className="h-5 w-5" />
                    </button>}
                    
                    {gs.headerExpanded && <button 
                        onClick={() => app.goToPage(ChatPageNames.chatUserGuide)}
                        className="btn-icon"
                        title="Help"
                    >
                        <FontAwesomeIcon icon={faQuestionCircle} className="h-5 w-5" />
                    </button>}
                    {!gs.headerExpanded && gs.chatConnected && gs.userProfile!.name && 
                <span className="ml-2 mt-1 font-semibold text-lg whitespace-nowrap">{`${gs.chatRoom} (${gs.chatParticipants!.size} others)`}</span>}

                    {!gs.headerExpanded && !gs.chatConnected && gs.userProfile!.name && 
                <span className="ml-2 mt-1 font-semibold text-lg whitespace-nowrap">{`Hi, ${gs.userProfile!.name}`}</span>}

                    {gs.chatConnected && <button 
                        onClick={toggleHeaderExpand}
                        className="btn-icon"
                        aria-label={gs.headerExpanded ? "Collapse header" : "Expand header"}
                    >
                        <FontAwesomeIcon icon={gs.headerExpanded ? faChevronUp : faChevronDown} className="h-5 w-5" />
                    </button>}
                </div>
            </div>
        </header>
    );
};
