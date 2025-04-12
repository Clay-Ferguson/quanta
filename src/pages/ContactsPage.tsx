import React from 'react';
import ContactsListComp from '../components/ContactsListComp';
import {app} from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '../components/LogoBlockComp';

const ContactsPage: React.FC = () => {
    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Contacts"/>
                <div className="flex items-center space-x-4">
                    <button 
                        onClick={() => app.goToPage('QuantaChat')}
                        className="p-2 text-blue-300 hover:bg-blue-600/30 rounded-md flex items-center justify-center"
                        title="Back"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5" />
                    </button>
                </div>
            </header>
            <div id="contactsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="contactsList" className="space-y-3">
                    <ContactsListComp />
                </div>
            </div>
        </div>
    );
};

export default ContactsPage;
