import React, { useState } from 'react';
import { Contact } from '../AppServiceIntf';
import { useGlobalState } from '../GlobalState';
import AppService from '../AppService';   

const app = AppService.getInst(); 

const ContactsList: React.FC = () => {
    const { contacts = [] } = useGlobalState();
    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [editingContact, setEditingContact] = useState<string | null>(null);
    const [newContact, setNewContact] = useState<Contact | null>(null);

    // Sort contacts alphabetically by name
    const sortedContacts = [...contacts].sort((a, b) => a.name.localeCompare(b.name));

    const toggleContactSelection = (publicKey: string) => {
        const newSelected = new Set(selectedContacts);
        if (newSelected.has(publicKey)) {
            newSelected.delete(publicKey);
        } else {
            newSelected.add(publicKey);
        }
        setSelectedContacts(newSelected);
    };

    const handleSelectAll = () => {
        if (selectedContacts.size === contacts.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(contacts.map(contact => contact.publicKey)));
        }
    };

    const handleEdit = (publicKey: string) => {
        setEditingContact(publicKey);
        // When editing one contact, clear any other editing state
        setNewContact(null);
    };

    const handleAddContact = () => {
        const emptyContact: Contact = {
            name: '',
            alias: '',
            publicKey: ''
        };
        setNewContact(emptyContact);
        setEditingContact(null);
    };

    const handleDelete = (publicKey: string) => {
        const updatedContacts = contacts.filter(contact => contact.publicKey !== publicKey);
        app._setContacts(updatedContacts);
    };

    const handleDeleteSelected = () => {
        const updatedContacts = contacts.filter(contact => !selectedContacts.has(contact.publicKey));
        app._setContacts(updatedContacts);
        setSelectedContacts(new Set());
    };

    return (
        <div className="w-full">
            <div className="mb-4 flex justify-between items-center">
                <div className="flex space-x-2">
                    <button 
                        className={`px-3 py-1 rounded text-sm ${selectedContacts.size === 0 
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                            : 'bg-red-600 hover:bg-red-700 text-white'}`}
                        disabled={selectedContacts.size === 0}
                        onClick={handleDeleteSelected}
                    >
            Delete Selected
                    </button>
                </div>
                <div>
                    <button 
                        className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={handleAddContact}
                    >
            Add Contact
                    </button>
                </div>
            </div>

            <div className="w-full overflow-x-auto border border-gray-700 rounded-md">
                <table className="min-w-full divide-y divide-gray-700">
                    <thead className="bg-gray-800">
                        <tr>
                            <th scope="col" className="w-12 px-3 py-2">
                                <input 
                                    type="checkbox" 
                                    className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                                    checked={contacts.length > 0 && selectedContacts.size === contacts.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Name
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Alias
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Public Key
                            </th>
                            <th scope="col" className="w-20 px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {newContact && (
                            <ContactEditRow 
                                contact={newContact}
                                isNew={true}
                                onSave={(contact) => {
                                    if (contact.name && contact.publicKey) {
                                        app._setContacts([...contacts, contact]);
                                    }
                                    setNewContact(null);
                                }}
                                onCancel={() => setNewContact(null)}
                            />
                        )}

                        {sortedContacts.length > 0 ? (
                            sortedContacts.map((contact) => (
                                editingContact === contact.publicKey ? (
                                    <ContactEditRow 
                                        key={contact.publicKey}
                                        contact={contact}
                                        onSave={(updatedContact) => {
                                            const updatedContacts = contacts.map(c => 
                                                c.publicKey === contact.publicKey ? updatedContact : c
                                            );
                                            app._setContacts(updatedContacts);
                                            setEditingContact(null);
                                        }}
                                        onCancel={() => setEditingContact(null)}
                                    />
                                ) : (
                                    <tr key={contact.publicKey} className="hover:bg-gray-750">
                                        <td className="px-3 py-2 whitespace-nowrap text-center">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-800"
                                                checked={selectedContacts.has(contact.publicKey)}
                                                onChange={() => toggleContactSelection(contact.publicKey)}
                                            />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{contact.name}</td>
                                        <td className="px-3 py-2 whitespace-nowrap">{contact.alias || '-'}</td>
                                        <td className="px-3 py-2">
                                            <div className="flex items-center">
                                                <span className="font-mono text-sm truncate max-w-[200px]" title={contact.publicKey}>
                                                    {contact.publicKey.length > 20
                                                        ? `${contact.publicKey.substring(0, 10)}...${contact.publicKey.substring(contact.publicKey.length - 10)}`
                                                        : contact.publicKey}
                                                </span>
                                                <button 
                                                    className="ml-2 text-xs bg-gray-700 hover:bg-gray-600 px-2 py-0.5 rounded"
                                                    onClick={() => navigator.clipboard.writeText(contact.publicKey)}
                                                >
                          Copy
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => handleEdit(contact.publicKey)}
                                                className="text-blue-400 hover:text-blue-300 mr-2"
                                            >
                        Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(contact.publicKey)}
                                                className="text-red-400 hover:text-red-300"
                                            >
                        Delete
                                            </button>
                                        </td>
                                    </tr>
                                )
                            ))
                        ) : (
                            !newContact && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-6 text-center text-gray-400">
                    No contacts found
                                    </td>
                                </tr>
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// Component to handle editing or creating a contact
const ContactEditRow: React.FC<{
  contact: Contact;
  isNew?: boolean;
  onSave: (updatedContact: Contact) => void;
  onCancel: () => void;
}> = ({ contact, isNew = false, onSave, onCancel }) => {
    const [editedContact, setEditedContact] = useState<Contact>({...contact});

    const handleChange = (field: keyof Contact, value: string) => {
        setEditedContact(prev => ({ ...prev, [field]: value }));
    };

    return (
        <tr className="bg-gray-750">
            <td className="px-3 py-2 whitespace-nowrap text-center">
                {isNew ? "New" : "✎"}
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <input
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                    value={editedContact.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Name"
                />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <input
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white"
                    value={editedContact.alias || ''}
                    onChange={(e) => handleChange('alias', e.target.value)}
                    placeholder="Alias (optional)"
                />
            </td>
            <td className="px-3 py-2 whitespace-nowrap">
                <input
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white font-mono"
                    value={editedContact.publicKey}
                    onChange={(e) => handleChange('publicKey', e.target.value)}
                    placeholder="Public Key"
                />
            </td>
            <td className="px-3 py-2 whitespace-nowrap text-right space-x-2">
                <button
                    onClick={() => onSave(editedContact)}
                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs"
                >
          Save
                </button>
                <button
                    onClick={onCancel}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-1 rounded text-xs"
                >
          Cancel
                </button>
            </td>
        </tr>
    );
};

export default ContactsList;