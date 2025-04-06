import { useGlobalState, useGlobalDispatch } from './GlobalState';
import { useState, useRef, useEffect } from 'react';
import './App.css'
import AppService from './AppService';
const app = AppService.getInst(); // Ensure the singleton is initialized

function QuantaChat() {
    const gs = useGlobalState();
    const dispatch = useGlobalDispatch();

    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
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
    
    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            // Convert FileList to array for easier manipulation
            const filesArray = Array.from(e.target.files);
            setSelectedFiles(filesArray);
        }
    };
    
    const send = () => {
        if ((!message.trim() && selectedFiles.length === 0) || !gs.connected) {
            console.log("Not connected or empty message with no attachments, not sending.");
            return;
        }
        
        // For now, we're just setting up the UI so we'll just log the files
        if (selectedFiles.length > 0) {
            console.log(`Sending message with ${selectedFiles.length} attachments`);
            // Later we'll process these files before sending
        }
        
        app.send(dispatch, message.trim(), null, gs);
        setMessage(''); // Clear the message input after sending
        setSelectedFiles([]); // Clear the selected files after sending
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const participants = 'Participants: ' + Array.from(gs.participants).join(', ');
    
    useEffect(() => {
        // Function to get URL parameters
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
        <div className="h-screen flex flex-col w-screen min-w-full">
            {/* Hidden file input element */}
            <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFiles}
            />
            
            {/* Rest of your component... */}
            <header className="w-full bg-blue-500 text-white p-4 flex-shrink-0 flex justify-between items-center">
                <div className="w-1/4">
                    <h1 className="text-xl font-semibold">QuantaChat</h1>
                    <h2 className="font-semibold">{participants}</h2>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <label htmlFor="userName" className="mr-2">Name:</label>
                        <input 
                            id="userName"
                            type="text" 
                            value={formData.userName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <div className="flex items-center">
                        <label htmlFor="roomName" className="mr-2">Room:</label>
                        <input 
                            id="roomName"
                            type="text" 
                            value={formData.roomName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <button 
                        disabled={!formData.userName || !formData.roomName || gs.connected}
                        onClick={connect}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Connect
                    </button>
                    <button 
                        onClick={disconnect}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Disconnect
                    </button>
                    <button 
                        onClick={clear}
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Clear
                    </button>
                </div>
            </header>

            <main id="chatLog" className="flex-grow overflow-y-auto p-4">
                <div className="space-y-2 max-w-full">
                    {gs.messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`${msg.sender === gs.userName ? 'bg-white' : 'bg-gray-200'} p-3 rounded-md shadow-sm flex`}
                        >
                            <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                <span className="font-semibold text-sm">{msg.sender}</span>
                                <span className="text-xs text-gray-500">
                                    {new Date(msg.timestamp).toLocaleDateString('en-US', { 
                                        month: '2-digit', 
                                        day: '2-digit', 
                                        year: '2-digit' 
                                    })} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="w-px bg-gray-300 self-stretch mx-2"></div>
                            <div className="flex-1 text-left">
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="w-full bg-gray-300 p-4 flex items-center flex-shrink-0">
                <textarea 
                    ref={textareaRef}
                    value={message}
                    onChange={handleMessageChange}
                    placeholder="Type your message..." 
                    className="flex-grow rounded-md border-gray-400 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto"
                />
                <button 
                    className="bg-blue-500 text-white rounded-md px-4 py-2 ml-2"
                    onClick={handleFileSelect}
                    disabled={!gs.connected}
                    title={selectedFiles.length === 0 ? 'Attach files' : `${selectedFiles.length} file(s) attached`}
                >
                    {selectedFiles.length ? `📎(${selectedFiles.length})` : '📎'}
                </button>
                <button 
                    className="bg-green-500 text-white rounded-md px-4 py-2 ml-2"
                    onClick={send}
                    disabled={!gs.connected}
                >
                    Send
                </button>
            </footer>
        </div>
    )
}

export default QuantaChat;