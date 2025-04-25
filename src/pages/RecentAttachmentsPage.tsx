import LogoBlockComp from '../components/LogoBlockComp';
import BackButton from '../components/BackButton';
import { useState, useEffect } from 'react';
import { useGlobalState } from '../GlobalState';
import { crypt } from '../../common/Crypto';

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
        return ""+new Date(timestamp); //todo-0: format date
    };

    // Truncate long text with ellipsis
    const truncateText = (text: string, maxLength: number): string => {
        if (!text) return '';
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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
                                        <th className="px-4 py-3 text-left">Attachment</th>
                                        <th className="px-4 py-3 text-left">Type</th>
                                        <th className="px-4 py-3 text-left">Size</th>
                                        <th className="px-4 py-3 text-left">Room</th>
                                        <th className="px-4 py-3 text-left">Sender</th>
                                        <th className="px-4 py-3 text-left">Date</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-600">
                                    {attachments.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-4 text-center text-gray-400">
                                                No attachments found
                                            </td>
                                        </tr>
                                    ) : (
                                        attachments.map((attachment) => (
                                            <tr key={attachment.id} className="hover:bg-gray-700">
                                                <td className="px-4 py-3">
                                                    <span className="font-medium">{truncateText(attachment.name, 30)}</span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {attachment.type}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {formatFileSize(attachment.size)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-900 text-blue-200 px-2 py-1 rounded">
                                                        {attachment.room_name}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <span>{attachment.sender}</span>
                                                        <span className="text-xs text-gray-400" title={attachment.public_key}>
                                                            {truncateText(attachment.public_key || '', 12)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300">
                                                    {formatDate(attachment.timestamp)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <a 
                                                        href={`/api/attachments/${attachment.id}`} 
                                                        target="_blank"
                                                        rel="noopener noreferrer" 
                                                        className="text-blue-400 hover:text-blue-300 mr-3"
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

