// import React, { useState } from 'react';
import { useGlobalState, useGlobalDispatch } from '../GlobalState';
// import AppService from '../AppService';

// const app = AppService.getInst(); 

const ContactsPage: React.FC = () => {
    const gs = useGlobalState();
    const gd = useGlobalDispatch();
    
    const handleDone = () => {
        gs.page = 'QuantaChat'; 
        gd({ type: 'setPage', payload: gs });
    };

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <header className="w-full bg-gray-800 text-gray-100 p-4 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="contactsLogo" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h1 className="text-xl font-semibold text-blue-400">Quanta Chat</h1>
                        <h2 className="font-semibold text-gray-300 truncate">Contacts</h2>
                    </div>
                </div>
            </header>
            <div id="contactsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="contactsList" className="space-y-3">
                    {/* Note to Claude AI: Put Contacts List Here, each one having ability to go
                     into "Edit Mode" where the name, alias, and publicKey turns into editable text fields right inline in the list.
                     
                     Contacts should be displayed alphabetically by 'name' */}
                </div>
                <div className="space-y-3 mt-4">
                    <div className="flex space-x-4">
                        {/* Note to Claude AI: Make 'Add Contact' create a new empty contact in the list which goes into edit mode */}
                        <button className="btn-primary">
                        Add Contact
                        </button>
                        <button className="btn-primary" onClick={handleDone}>Done</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
