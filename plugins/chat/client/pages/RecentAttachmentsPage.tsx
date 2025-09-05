import LogoBlockComp from '../../../../client/components/LogoBlockComp';
import BackButtonComp from '../../../../client/components/BackButtonComp';
import { useState, useEffect } from 'react';
import { useGlobalState } from '../ChatTypes';
import HexKeyComp from '../../../../client/components/HexKeyComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash} from '@fortawesome/free-solid-svg-icons';
import AvatarImageComp from '../../../../client/components/AvatarImageComp';
import { util } from '../../../../client/Util';
import { httpClientUtil } from '../../../../client/HttpClientUtil';
import { AttachmentInfo } from '../../../../common/types/CommonTypes';
import { GetRecentAttachments_Response } from '../../../../common/types/EndpointTypes';
import { confirmModal } from '../../../../client/components/ConfirmModalComp';
import appMessages from '../AppMessages';
import { formatDate } from '../../../../common/CommonUtils';

declare const ADMIN_PUBLIC_KEY: string;

interface RecentAttachmentsPageProps {
    pluginTitle?: string;
}

/**
 * Displays a list of recent attachments sent in the chat application, which are saved to the server. Maily for moderation purposes and to keep an eye
 * on the content being shared.
 */
export default function RecentAttachmentsPage({ pluginTitle }: RecentAttachmentsPageProps) {
    const gs = useGlobalState();
    const [loading, setLoading] = useState(true);
    const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
    const [error, setError] = useState<string | null>(null);

    const getAttachmentsInfo = async () => {
        setLoading(true);
        try {
            const response: GetRecentAttachments_Response | null = 
                await httpClientUtil.secureHttpPost<any, GetRecentAttachments_Response>(`/api/admin/get-recent-attachments`);
            if (response && response.attachments) {
                setAttachments(response.attachments);
            } else {
                setError('Failed to retrieve attachment data');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => util.resizeEffect(), []);

    // Call getAttachmentsInfo when component mounts
    useEffect(() => {
        getAttachmentsInfo();
    }, []);

    if (!ADMIN_PUBLIC_KEY) {
        console.error('Admin public key is not set.');
        return null;
    }

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
        if (!await confirmModal(`Are you sure you want to delete this attachment?`)) {
            return;
        }
         
        await httpClientUtil.secureHttpPost(`/api/attachments/${id}/delete`);
        
        const updatedAttachments = attachments.filter(att => att.id !== id);
        setAttachments(updatedAttachments);

        // now scan the 'gs.messages' array which is an array of ChatMessage objects and remove any attachments that are in the 'attachments' array of the ChatMessage object
        gs.chatMessages = gs.chatMessages!.map(msg => {
            if (msg.attachments) {
                msg.attachments = msg.attachments.filter(att => att.id !== id);
            }
            return msg;
        });
        appMessages.setMessages(gs.chatMessages)
    };

    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Recent Attachments" pluginTitle={pluginTitle}/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
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
                                                        <div className="text-sm text-gray-400">{util.formatFileSize(attachment.size)}</div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className="bg-blue-900 text-blue-200 px-2 py-1 rounded">
                                                        {attachment.roomName}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex flex-col">
                                                        <AvatarImageComp publicKey={attachment.publicKey} name="{attachment.sender}" />
                                                        <span>{attachment.sender}</span>
                                                        <HexKeyComp hexKey={attachment.publicKey} />
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
                                                            onClick={() => deleteAttachment(attachment.id)}
                                                            className={'cursor-pointer text-red-400 hover:text-red-300'}
                                                            title="Delete attachment"
                                                        >
                                                            <FontAwesomeIcon 
                                                                icon={faTrash} 
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

