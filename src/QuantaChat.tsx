import { useGlobalState, useGlobalDispatch } from './GlobalState';
import { useState, useRef, useEffect } from 'react';
import AppService from './AppService';
const app = AppService.getInst(); 

function QuantaChat() {
    const gs = useGlobalState();
    const dispatch = useGlobalDispatch();

    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // Add state for the full-size image viewer
    const [fullSizeImage, setFullSizeImage] = useState<{
        src: string;
        name: string;
    } | null>(null);
    
    // Auto-resize function for textarea
    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            // Reset height to auto to get the correct scrollHeight
            textarea.style.height = 'auto';
            // Set new height but cap it with CSS max-height
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [message]);
    
    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
    };
    
    // Local state for form fields
    const [formData, setFormData] = useState({
        userName: gs.userName || '',
        roomName: gs.roomName || ''
    });

    const handleInputChange = (e: any) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const connect = async () => {
        app._connect(dispatch, formData.userName, formData.roomName);
    };

    const disconnect = () => {
        app._disconnect(dispatch);
    };

    const clear = () => {
        if (gs.connected) {
            app._clearMessages(dispatch);
        } else {
            console.log("Not connected, cannot clear messages.");
        }
    };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };
    
    // Add this utility function to convert file to base64
    // todo-0: this was already in Utils, but AI duplicated it here.
    const fileToBase64 = (file: File): Promise<{
        name: string;
        type: string;
        size: number;
        data: string;
    }> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result as string
            });
            reader.onerror = error => reject(error);
        });
    };

    // Update the toggleFullSize function to handle opening the full-size image viewer
    const toggleFullSize = (src: string, name: string) => {
        setFullSizeImage(fullSizeImage ? null : { src, name });
    };

    // Modify the handleFiles function to convert files to base64
    const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            try {
                const filesArray = Array.from(e.target.files);
                setSelectedFiles(filesArray);
            } catch (error) {
                console.error("Error processing files:", error);
            }
        }
    };

    // Utility function to format file size
    // todo-0: I think I have a Utils method for this already.
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    // Update the send function to convert files to base64 before sending
    const send = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || !gs.connected) {
            console.log("Not connected or empty message with no attachments, not sending.");
            return;
        }
        
        if (selectedFiles.length > 0) {
            try {
                console.log(`Sending message with ${selectedFiles.length} attachments`);
                
                // Convert all files to base64 format
                const processedAttachments = await Promise.all(
                    selectedFiles.map(file => fileToBase64(file))
                );
                
                // Send message with attachments
                app.send(dispatch, message.trim(), processedAttachments, gs);
            } catch (error) {
                console.error("Error processing attachments:", error);
            }
        } else {
            // Send message without attachments
            app.send(dispatch, message.trim(), null, gs);
        }
        
        setMessage(''); // Clear the message input after sending
        setSelectedFiles([]); // Clear the selected files after sending
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const participants = 'Members: ' + Array.from(gs.participants).join(', ');
    
    useEffect(() => {
        // Get URL parameters
        const getUrlParameter = (name: string): string | null => {
            const searchParams = new URLSearchParams(window.location.search);
            return searchParams.get(name);
        };
        
        // Get userName and roomName from URL if they exist
        const userNameParam = getUrlParameter('user');
        const roomNameParam = getUrlParameter('room');
        
        // Update form data if URL parameters exist
        if (userNameParam || roomNameParam) {
            setFormData(prev => ({
                userName: userNameParam || prev.userName,
                roomName: roomNameParam || prev.roomName
            }));
        }
        
        // Auto-connect if both parameters are present
        if (userNameParam && roomNameParam && !gs.connected) {
            // Use a short timeout to ensure state is updated before connecting
            const timer = setTimeout(() => {
                app._connect(dispatch, userNameParam, roomNameParam);
            }, 100);
            
            return () => clearTimeout(timer);
        }
    }, []);  // Empty dependency array means this runs once on component mount

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            {/* Hidden file input element */}
            <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFiles}
            />
            
            <header className="w-full bg-gray-800 text-gray-100 p-4 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="logoTextAndMembers" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h1 className="text-xl font-semibold text-blue-400">Quanta Chat</h1>
                        <h2 className="font-semibold text-gray-300 truncate">{participants}</h2>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {!gs.connected ? (
                        <>
                            <div className="flex items-center">
                                <label htmlFor="userName" className="mr-2 text-gray-300">Name:</label>
                                <input 
                                    id="userName"
                                    type="text" 
                                    value={formData.userName} 
                                    onChange={handleInputChange}
                                    className="rounded px-2 py-1 bg-gray-700 text-gray-100 border border-gray-600 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                />
                            </div>
                            <div className="flex items-center">
                                <label htmlFor="roomName" className="mr-2 text-gray-300">Room:</label>
                                <input 
                                    id="roomName"
                                    type="text" 
                                    value={formData.roomName} 
                                    onChange={handleInputChange}
                                    className="rounded px-2 py-1 bg-gray-700 text-gray-100 border border-gray-600 w-28 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                                />
                            </div>
                            <button 
                                disabled={!formData.userName || !formData.roomName}
                                onClick={connect}
                                className="bg-green-600 hover:bg-green-700 text-gray-100 font-medium py-1 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Connect
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center bg-gray-700 rounded px-3 py-1 border border-gray-600">
                                <div className="w-3 h-3 rounded-full bg-green-500 mr-2 animate-pulse" title="Connected"></div>
                                <div className="flex flex-col">
                                    <span className="text-sm text-gray-300">User: <span className="text-blue-400 font-medium">{gs.userName}</span></span>
                                    <span className="text-sm text-gray-300">Room: <span className="text-purple-400 font-medium">{gs.roomName}</span></span>
                                </div>
                            </div>
                            <button 
                                onClick={disconnect}
                                className="bg-red-600 hover:bg-red-700 text-gray-100 font-medium py-1 px-4 rounded"
                            >
                                Disconnect
                            </button>
                            <button 
                                onClick={clear}
                                className="bg-yellow-600 hover:bg-yellow-700 text-gray-100 font-medium py-1 px-4 rounded"
                            >
                                Clear
                            </button>
                        </>
                    )}
                </div>
            </header>

            <main id="chatLog" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div className="space-y-3 max-w-full">
                    {gs.messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`${msg.sender === gs.userName ? 'bg-gray-700 border-l-4 border-blue-500' : 'bg-gray-800'} p-3 rounded-md shadow-md flex flex-col`}
                        >
                            <div className="flex">
                                <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                    <span className="font-semibold text-sm text-blue-400">{msg.sender}</span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(msg.timestamp).toLocaleDateString('en-US', { 
                                            month: '2-digit', 
                                            day: '2-digit', 
                                            year: '2-digit' 
                                        })} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                        {msg.attachments.map((attachment: any, attIndex) => (
                                            <div key={attIndex} className="attachment-container border border-gray-600 rounded p-2 flex flex-col bg-gray-800">
                                                {attachment.type.startsWith('image/') ? (
                                                    <>
                                                        {/* Image attachment */}
                                                        <div className="relative">
                                                            <img 
                                                                src={attachment.data}
                                                                alt={attachment.name}
                                                                className="max-w-full rounded cursor-pointer max-h-40 object-contain"
                                                                onClick={() => toggleFullSize(attachment.data, attachment.name)}
                                                                title="Click to view full size"
                                                            />
                                                            <button 
                                                                className="absolute top-1 right-1 bg-blue-600 text-gray-100 rounded-full w-8 h-8 flex items-center justify-center hover:bg-blue-700"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // For base64 data, we can use it directly for download
                                                                    const downloadLink = document.createElement('a');
                                                                    downloadLink.href = attachment.data;
                                                                    downloadLink.download = attachment.name;
                                                                    document.body.appendChild(downloadLink);
                                                                    downloadLink.click();
                                                                    document.body.removeChild(downloadLink);
                                                                }}
                                                                title={`Download ${attachment.name}`}
                                                            >
                                                                ⬇️
                                                            </button>
                                                        </div>
                                                        <div className="text-xs mt-1 truncate text-gray-300">{attachment.name}</div>
                                                    </>
                                                ) : (
                                                    <>
                                                        {/* Non-image attachment */}
                                                        <div className="flex items-center">
                                                            <span className="text-2xl mr-2">📄</span>
                                                            <div className="flex-1">
                                                                <div className="font-medium text-sm truncate text-gray-200">{attachment.name}</div>
                                                                <div className="text-xs text-gray-400">{formatFileSize(attachment.size)}</div>
                                                            </div>
                                                            <button 
                                                                className="bg-blue-600 text-gray-100 rounded px-2 py-1 text-sm hover:bg-blue-700"
                                                                onClick={() => {
                                                                    const downloadLink = document.createElement('a');
                                                                    downloadLink.href = attachment.data;
                                                                    downloadLink.download = attachment.name;
                                                                    document.body.appendChild(downloadLink);
                                                                    downloadLink.click();
                                                                    document.body.removeChild(downloadLink);
                                                                }}
                                                                title={`Download ${attachment.name}`}
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

            <footer className="w-full bg-gray-800 p-4 flex items-center flex-shrink-0 shadow-md border-t border-blue-400/30">
                <textarea 
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type your message..." 
                    className="flex-grow rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-800"
                    disabled={!gs.connected}
                />
                <button 
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md px-4 py-2 ml-2 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                    onClick={handleFileSelect}
                    disabled={!gs.connected}
                    title={selectedFiles.length === 0 ? 'Attach files' : `${selectedFiles.length} file(s) attached`}
                >
                    {selectedFiles.length ? `📎(${selectedFiles.length})` : '📎'}
                </button>
                <button 
                    className="bg-blue-600 hover:bg-blue-700 text-gray-100 rounded-md px-4 py-2 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={send}
                    disabled={!gs.connected}
                >
                    Send
                </button>
            </footer>
            
            {/* Full-size image viewer modal */}
            {fullSizeImage && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 overflow-auto"
                    onClick={() => setFullSizeImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <button 
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFullSizeImage(null);
                            }}
                        >
                            ✕
                        </button>
                        <div className="bg-gray-800 p-3 rounded shadow-lg border border-gray-700">
                            <h3 className="text-center text-lg font-medium mb-2 text-gray-200">{fullSizeImage.name}</h3>
                            <img 
                                src={fullSizeImage.src} 
                                alt={fullSizeImage.name}
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default QuantaChat;