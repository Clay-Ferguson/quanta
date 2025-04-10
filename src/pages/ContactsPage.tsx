import React from 'react';
import ContactsList from '../components/ContactsList';
import AppService from '../AppService';

const app = AppService.getInst(); 

const ContactsPage: React.FC = () => {
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
                        <h3 className="font-semibold text-blue-400">Quanta Chat</h3>
                        <h5 className="font-semibold text-gray-300 truncate">Contacts</h5>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button className="btn-primary" onClick={app.goToMainPage}>Back</button>
                </div>
            </header>
            <div id="contactsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="contactsList" className="space-y-3">
                    <ContactsList />
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
