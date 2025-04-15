import ContactsListComp from '../components/ContactsListComp';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';

export default function ContactsPage() {
    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Contacts"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>
            <div id="contactsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div id="contactsList" className="space-y-3">
                    <ContactsListComp />
                </div>
            </div>
        </div>
    );
}
