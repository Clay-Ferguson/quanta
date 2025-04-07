import React from 'react';
import Util from '../Util';

interface MessageAttachment {
  name: string;
  type: string;
  size: number;
  data: string;
}

interface Message {
  sender: string;
  timestamp: number;
  content: string;
  attachments?: MessageAttachment[];
}

interface MainCompProps {
  messages: Message[];
  currentUserName: string;
  toggleFullSize: (src: string, name: string) => void;
}

const MainComp: React.FC<MainCompProps> = ({
    messages,
    currentUserName,
    toggleFullSize
}) => {
    const util = Util.getInst();

    const downloadFile = (attachment: MessageAttachment) => {
        const downloadLink = document.createElement('a');
        downloadLink.href = attachment.data;
        downloadLink.download = attachment.name;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    }

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
                                        <div key={idx} className="attachment-container border border-gray-600 rounded p-2 flex flex-col bg-gray-800">
                                            {att.type.startsWith('image/') ? (
                                                <>
                                                    {/* Image attachment */}
                                                    <div className="relative">
                                                        <img 
                                                            src={att.data}
                                                            alt={att.name}
                                                            className="max-w-full rounded cursor-pointer max-h-40 object-contain"
                                                            onClick={() => toggleFullSize(att.data, att.name)}
                                                            title="Click to view full size"
                                                        />
                                                        <button 
                                                            className="absolute top-1 right-1 bg-blue-600 text-gray-100 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                downloadFile(att);
                                                            }}
                                                            title={`Download ${att.name}`}
                                                        >
                              ⬇️
                                                        </button>
                                                    </div>
                                                    <div className="text-xs mt-1 truncate text-gray-300">{att.name}</div>
                                                </>
                                            ) : (
                                                <>
                                                    {/* Non-image attachment */}
                                                    <div className="flex items-center">
                                                        <span className="text-2xl mr-2">📄</span>
                                                        <div className="flex-1">
                                                            <div className="font-medium text-sm truncate text-gray-200">{att.name}</div>
                                                            <div className="text-xs text-gray-400">{util.formatFileSize(att.size)}</div>
                                                        </div>
                                                        <button 
                                                            className="bg-blue-600 text-gray-100 rounded px-2 py-1 text-sm hover:bg-blue-700"
                                                            onClick={() => {
                                                                downloadFile(att);
                                                            }}
                                                            title={`Download ${att.name}`}
                                                        >
                              Download
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
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