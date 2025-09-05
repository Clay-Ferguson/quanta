import React, { useState } from 'react';
import { gd, useGlobalState } from '../ChatTypes';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUserEdit, faTrash, faUser } from '@fortawesome/free-solid-svg-icons';
import HexKeyComp from '../../../../client/components/HexKeyComp';
import AvatarImageComp from '../../../../client/components/AvatarImageComp';
import { Contact } from '../../../../common/types/CommonTypes';
import { confirmModal } from '../../../../client/components/ConfirmModalComp';
import { alertModal } from '../../../../client/components/AlertModalComp';
import { DBKeys } from '../../../../client/AppServiceTypes';
import { idb } from '../../../../client/IndexedDB';

/**
 * Displays a list of contacts with options to add, edit, delete, and select multiple contacts.
 */
export default function ContactsListComp() {
    const gs = useGlobalState();
    if (!gs.chatContacts) {
        gs.chatContacts = [];
    }

    function setContacts(contacts: any) {
        // Save into global state
        gd({ type: 'setContacts', payload: { chatContacts: contacts }});

        // Save to IndexedDB
        idb.setItem(DBKeys.chatContacts, contacts);
    }

    const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
    const [editingContact, setEditingContact] = useState<string | null>(null);
    const [newContact, setNewContact] = useState<Contact | null>(null);

    // Sort contacts alphabetically by name
    const sortedContacts = [...gs.chatContacts!].sort((a, b) => a.alias.localeCompare(b.alias));

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
        if (selectedContacts.size === gs.chatContacts!.length) {
            setSelectedContacts(new Set());
        } else {
            setSelectedContacts(new Set(gs.chatContacts!.map(contact => contact.publicKey)));
        }
    };

    const handleEdit = (publicKey: string) => {
        setEditingContact(publicKey);
        // When editing one contact, clear any other editing state
        setNewContact(null);
    };

    const handleAddContact = () => {
        const emptyContact: Contact = {
            alias: '',
            publicKey: ''
        };
        setNewContact(emptyContact);
        setEditingContact(null);
    };

    const handleDelete = async (contact: Contact) => {
        if (!await confirmModal(`Are you sure you want to delete contact '${contact.alias}' ?`)) return;
        const updatedContacts = gs.chatContacts!.filter(c => c.publicKey !== contact.publicKey);
        setContacts(updatedContacts);
    };

    const handleDeleteSelected = () => {
        const updatedContacts = gs.chatContacts!.filter(contact => !selectedContacts.has(contact.publicKey));
        setContacts(updatedContacts);
        setSelectedContacts(new Set());
    };

    const saveContact = async (contact: Contact) => {
        if (!contact.publicKey || !contact.alias) {
            await alertModal('Public Key and Alias is required');
            return;
        }
        contact.publicKey = contact.publicKey.trim();
        contact.alias = contact.alias.trim();

        // If alias exists show error about that
        if (gs.chatContacts!.some(c => c.alias === contact.alias)) {
            await alertModal('Alias already exists');
            return;
        }

        // If alias exists show error about that
        if (gs.chatContacts!.some(c => c.publicKey === contact.publicKey)) {
            await alertModal('Alias already exists');
            return;
        }
        
        setContacts([...gs.chatContacts!, contact]);
        setNewContact(null);
    }

    return (
        <div className="w-full">
            <div className="mb-4 flex justify-between items-center">
                <div className="flex space-x-2">
                    <button 
                        className={`${selectedContacts.size === 0 ? 'btn-secondary' : 'btn-danger'}`}
                        disabled={selectedContacts.size === 0}
                        onClick={handleDeleteSelected}
                    >
                        Delete Selected
                    </button>
                </div>
                <div>
                    <button 
                        className="btn-primary"
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
                                    checked={gs.chatContacts!.length > 0 && selectedContacts.size === gs.chatContacts!.length}
                                    onChange={handleSelectAll}
                                />
                            </th>
                            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                                Avatar
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
                                onSave={saveContact}
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
                                            const updatedContacts = gs.chatContacts!.map(c => 
                                                c.publicKey === contact.publicKey ? updatedContact : c
                                            );
                                            setContacts(updatedContacts);
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
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            <div className="flex-shrink-0">
                                                <AvatarImageComp
                                                    publicKey={contact.publicKey}
                                                    name={contact.alias || ''}
                                                />
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">{contact.alias || '-'}</td>
                                        <td className="px-3 py-2">
                                            <HexKeyComp hexKey={contact.publicKey} />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-right text-sm font-medium">
                                            <FontAwesomeIcon 
                                                icon={faUserEdit} 
                                                onClick={() => handleEdit(contact.publicKey)}
                                                className="text-blue-400 hover:text-blue-300 cursor-pointer mr-4"
                                            />
                                            <FontAwesomeIcon 
                                                icon={faTrash} 
                                                onClick={() => handleDelete(contact)}
                                                className="text-red-400 hover:text-red-300 cursor-pointer"
                                            />
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
            <td className="px-3 py-2 whitespace-nowrap text-center">
                <div className="w-10 h-10 bg-gray-700 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faUser} className="text-gray-400 text-lg" />
                </div>
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