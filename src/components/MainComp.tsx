import React from 'react';
import AttachmentComp from './AttachmentComp';
import { ChatMessage } from '../AppServiceTypes';
import Markdown from './MarkdownComp';
import { useGlobalState } from '../GlobalState';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCertificate } from '@fortawesome/free-solid-svg-icons';

const MainComp: React.FC = () => {
    const gs = useGlobalState();

    const formatMessageTime = (msg: ChatMessage) => {
        return new Date(msg.timestamp).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Show not connected message if user is not connected
    if (!gs.connected) {
        return (
            <main id="chatLog" className="flex-grow overflow-y-auto p-4 bg-gray-900 flex items-center justify-center">
                <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg max-w-md">
                    <h2 className="text-2xl font-bold text-blue-400 mb-4">Not Connected</h2>
                    <p className="text-gray-300 mb-2">Enter a room name in the field above and click "Join" to get started chatting.</p>
                    <p className="text-gray-400 text-sm">You'll be able to see messages and share files once you're connected to a room.</p>
                </div>
            </main>
        );
    }

    return (
        <main id="chatLog" className="flex-grow overflow-y-auto p-4 bg-gray-900">
            <div className="space-y-3 max-w-full">
                {gs.messages.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`${msg.sender === gs.userName ? 'bg-gray-700 border-l-4 border-blue-500' 
                            : 'bg-gray-800 border-l-4 border-transparent'} p-3 rounded-md shadow-md flex flex-col`}
                    >
                        <div className="flex">
                            <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                <div className="flex items-center">
                                    <span className={`flex items-center ${msg.trusted ? 'text-yellow-400' : 'text-orange-500'}`}>
                                        {msg.trusted ? (
                                            <FontAwesomeIcon icon={faCertificate} className="h-4 w-4 mr-1.5" />
                                        ) : (
                                            <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 mr-1.5" />
                                        )}
                                    </span>
                                    <span className="font-semibold text-sm text-blue-400">{msg.sender}</span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {formatMessageTime(msg)}
                                </span>
                            </div>
                            <div className="w-0.5 bg-gray-400 self-stretch mx-2"></div>
                            <div className="flex-1 text-left text-gray-200">
                                <Markdown markdownContent={msg.content} />
                            </div>
                        </div>
            
                        {/* Attachments section */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {msg.attachments.map((att, idx) => (
                                        <AttachmentComp 
                                            key={idx}
                                            attachment={att} 
                                            index={idx} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </main>
    );
};

export default MainComp;