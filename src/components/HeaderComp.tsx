import React, { useEffect, useState } from 'react';
import AppService from '../AppService';
import { useGlobalState } from '../GlobalState';

const app = AppService.getInst(); 

const HeaderComp: React.FC = () => {
    const gs = useGlobalState();
    const [roomName, setRoomName] = useState('');
    
    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.roomName) {
            setRoomName(gs.roomName);
        }
    }, [gs.roomName]);

    let participants = null;
    if (gs.connected) {
        if (gs.participants.size === 0) {
            participants = `No one else is in this room.`;
        }
        else {
            participants = `Members: You, ${Array.from(gs.participants).sort().join(', ')}`
        }
    }
    else {
        participants = '';
    }
    
    return (
        <header className="w-full bg-gray-800 text-gray-100 p-2 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
            <div id="logoTextAndMembers" className="flex-1 flex items-center">
                <div className="mr-3">
                    <img 
                        src="/logo-100px-tr.jpg" 
                        alt="Quanta Chat Logo" 
                        className="h-auto object-contain border border-blue-400/30 rounded"
                    />
                </div>
                <div className="overflow-hidden">
                    <h3 className="font-semibold text-blue-400">Quanta Chat</h3>
                    <h5 className="font-semibold text-gray-300 truncate">{participants}</h5>
                </div>
            </div>
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
                                onClick={() => app._connect(null, roomName)}
                                className="bg-green-600 hover:bg-green-700 text-gray-100 font-medium py-1 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
                                onClick={app._disconnect}
                                className="btn-danger"
                            >
                                Leave
                            </button>
                            <button 
                                onClick={app._clearMessages}
                                className="btn-warning"
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>
                <button 
                    onClick={() => app.goToPage('ContactsPage')}
                    className="btn-secondary"
                >
                    Contacts
                </button>
                <button 
                    onClick={() => app.goToPage('SettingsPage')}
                    className="btn-secondary"
                >
                    Settings
                </button>
                <button
                    onClick={() => app.goToPage('UserGuidePage')}
                    className="p-2 ml-2 text-blue-300 hover:bg-blue-600/30 rounded-md"
                    title="Help"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </button> 
            </div>
        </header>
    );
};

export default HeaderComp;