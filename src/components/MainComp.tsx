import React from 'react';
import AttachmentComp from './AttachmentComp';
import { ChatMessage } from '../AppServiceIntf';

interface MainCompProps {
  messages: ChatMessage[];
  currentUserName: string;
  toggleFullSize: (src: string, name: string) => void;
}

const MainComp: React.FC<MainCompProps> = ({
    messages,
    currentUserName,
    toggleFullSize
}) => {

    const formatMessageTime = (msg: any) => {
        return new Date(msg.timestamp).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <main id="chatLog" className="flex-grow overflow-y-auto p-4 bg-gray-900">
            <div className="space-y-3 max-w-full">
                {messages.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`${msg.sender === currentUserName ? 'bg-gray-700 border-l-4 border-blue-500' 
                            : 'bg-gray-800 border-l-4 border-transparent'} p-3 rounded-md shadow-md flex flex-col`}
                    >
                        <div className="flex">
                            <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                <span className="font-semibold text-sm text-blue-400">{msg.sender}</span>
                                <span className="text-xs text-gray-400">
                                    {formatMessageTime(msg)}
                                </span>
                            </div>
                            <div className="w-px bg-gray-600 self-stretch mx-2"></div>
                            <div className="flex-1 text-left text-gray-200">
                                {msg.content}
                            </div>
                        </div>
            
                        {/* Attachments section */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-600">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {msg.attachments.map((att, idx) => (
                                        <AttachmentComp 
                                            key={idx}
                                            attachment={att} 
                                            toggleFullSize={toggleFullSize} 
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