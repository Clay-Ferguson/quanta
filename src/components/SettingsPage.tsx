import React from 'react';
import { useGlobalState, useGlobalDispatch } from '../GlobalState';

const SettingsPage: React.FC = () => {
    const gs = useGlobalState();
    const gd = useGlobalDispatch();
    
    const handleDone = () => {
        gs.page = 'QuantaChat'; 
        gd({ type: 'setPage', payload: gs });
    };

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <header className="w-full bg-gray-800 text-gray-100 p-4 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="logoTextAndMembers" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h1 className="text-xl font-semibold text-blue-400">Quanta Chat</h1>
                        <h2 className="font-semibold text-gray-300 truncate">Settings</h2>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div className="space-y-3 max-w-full">
                    <div>
                    We'll have some settings here soon!
                    </div>
                    <button className="btn-primary" onClick={handleDone}>Done</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
