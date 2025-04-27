import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { useState, useEffect } from 'react';
import { useGlobalState } from '../GlobalState';
import { crypt } from '../../common/Crypto';
import PublicKeyComp from '../components/PublicKeyComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSpinner, faCheck, faTimes } from '@fortawesome/free-solid-svg-icons';

declare const ADMIN_PUBLIC_KEY: string;

interface Attachment {
    id: number;
    name: string;
    type: string;
    size: number;
    message_id: string;
    sender: string;
    public_key: string;
    timestamp: number;
    room_name: string;
}

export default function RecentAttachmentsPage() {
    const gs = useGlobalState();
    const [loading, setLoading] = useState(true);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [deleteStatus, setDeleteStatus] = useState<{id: number, status: string} | null>(null);

    const getAttachmentsInfo = async () => {
        setLoading(true);
        try {
            const response = await crypt.secureHttpPost(`/api/admin/get-recent-attachments`, gs.keyPair!);
            
            if (response.success && response.attachments) {
                setAttachments(response.attachments);
            } else {
                setError('Failed to retrieve attachment data');
            }
        } catch (error) {
            console.error('Error fetching attachments info:', error);
            setError('An error occurred while fetching attachment information');
        } finally {
            setLoading(false);
        }
    };

    // Call getAttachmentsInfo when component mounts
    useEffect(() => {
        getAttachmentsInfo();
    }, []);

    if (!ADMIN_PUBLIC_KEY) {
        console.error('Admin public key is not set. Please set the QUANTA_CHAT_ADMIN_PUBLIC_KEY environment variable.');
        return null;
    }

    // Format file size for human readability
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
        else return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    };

    // Format timestamp to readable date
    const formatDate = (timestamp: number): string => {
        return new Date(timestamp).toLocaleString();
    };

    // Truncate long text with ellipsis
    const truncateText = (text: string, maxLength: number): string => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    // Check if attachment is an image
    const isImage = (type: string): boolean => {
        return type.startsWith('image/');
    };

    const deleteAttachment = async (id: number) => {
        if (!confirm(`Are you sure you want to delete this attachment?`)) {
            return;
        }
        
        setDeleteStatus({id, status: 'deleting'});
        
        try {
            const response =  await crypt.secureHttpPost(`/api/attachments/${id}/delete`, gs.keyPair!, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                setDeleteStatus({id, status: 'success'});
                // Remove the deleted attachment from the list
                setAttachments(prev => prev.filter(att => att.id !== id));

                // now scan the 'gs.messages' array which is an array of ChatMessage objects and remove any attachments that are in the 'attachments' array of the ChatMessage object
                // todo-0: oops we don't have the attachment ID available in the message object yet.
                // gs.messages = gs.messages!.map(msg => {
                //     if (msg.attachments) {
                //         msg.attachments = msg.attachments.filter(att => att.id !== id);
                //     }
                //     return msg;
                // });

                setTimeout(() => setDeleteStatus(null), 2000);
            } else {
                setDeleteStatus({id, status: 'failed'});
                setTimeout(() => setDeleteStatus(null), 3000);
            }
        } catch (error) {
            console.error('Error deleting attachment:', error);
            setDeleteStatus({id, status: 'failed'});
            setTimeout(() => setDeleteStatus(null), 3000);
        }
    };

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Recent Attachments"/>
                <div className="flex items-center space-x-4">
                    <BackButton/>
                </div>
            </header>

            <div id="recentAttachmentsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">            
                <div className="space-y-6 max-w-6xl mx-auto">
                    {error && (
                        <div className="bg-red-500 text-white p-3 rounded mb-4">
                            {error}
                        </div>
                    )}
                    
                    {loading ? (
                        <div className="flex justify-center items-center h-32">
                            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                            <span className="ml-3 text-gray-300">Loading attachments...</span>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full bg-gray-800 text-gray-200 rounded-lg overflow-hidden">
                                <thead className="bg-gray-700">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Preview</th>
                                        <th className="px-4 py-3 text-left">Details</th>
                                        <th className="px-4 py-3 text-left">Room</th>
                                        <th className="px-4 py-3 text-left">Sender</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-600">
                                    {attachments.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-4 text-center text-gray-400">
                                                No attachments found
                                            </td>
                                        </tr>
                                    ) : (
                                        attachments.map((attachment) => (
                                            <tr key={attachment.id} className="hover:bg-gray-700">
                                                <td className="px-4 py-3 w-40">
                                                    {isImage(attachment.type) ? (
                                                        <div className="flex flex-col items-center">
                                                            <img 
                                                                src={`/api/attachments/${attachment.id}`} 
                                                                alt={attachment.name}
                                                                style={{ width: '150px', height: 'auto', objectFit: 'contain' }}
                                                                className="mb-1 rounded border border-gray-600"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center justify-center px-3 py-2 bg-gray-700 rounded w-32 h-24">
                                                            <span className="text-center text-gray-300">{attachment.type.split('/')[1]?.toUpperCase() || 'FILE'}</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="space-y-1">
                                                        <div className="font-medium">{truncateText(attachment.name, 30)}</div>
                                                        <div className="text-sm text-gray-400">{attachment.type}</div>
                                                        <div className="text-sm text-gray-400">{formatFileSize(attachment.size)}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-900 text-blue-200 px-2 py-1 rounded">
                                                        {attachment.room_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span>{attachment.sender}</span>
                                                        <PublicKeyComp publicKey={attachment.public_key} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {formatDate(attachment.timestamp)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col space-y-2">
                                                        <a 
                                                            href={`/api/attachments/${attachment.id}`} 
                                                            target="_blank"
                                                            rel="noopener noreferrer" 
                                                            className="text-blue-400 hover:text-blue-300"
                                                        >
                                                            View
                                                        </a>
                                                        <a 
                                                            href={`/api/attachments/${attachment.id}`} 
                                                            download={attachment.name}
                                                            className="text-green-400 hover:text-green-300"
                                                        >
                                                            Download
                                                        </a>
                                                        <div 
                                                            onClick={() => deleteStatus?.id === attachment.id && deleteStatus.status === 'deleting' ? null : deleteAttachment(attachment.id)}
                                                            className={`cursor-pointer ${
                                                                deleteStatus?.id === attachment.id 
                                                                    ? deleteStatus.status === 'deleting'
                                                                        ? 'text-gray-500 cursor-not-allowed'
                                                                        : deleteStatus.status === 'success'
                                                                            ? 'text-green-500'
                                                                            : 'text-red-500'
                                                                    : 'text-red-400 hover:text-red-300'
                                                            }`}
                                                            title="Delete attachment"
                                                        >
                                                            <FontAwesomeIcon 
                                                                icon={
                                                                    deleteStatus?.id === attachment.id
                                                                        ? deleteStatus.status === 'deleting'
                                                                            ? faSpinner
                                                                            : deleteStatus.status === 'success'
                                                                                ? faCheck
                                                                                : faTimes
                                                                        : faTrash
                                                                } 
                                                                className={deleteStatus?.id === attachment.id && deleteStatus.status === 'deleting' ? 'animate-spin' : ''}
                                                            />
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

