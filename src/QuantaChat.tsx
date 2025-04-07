import { useGlobalState } from './GlobalState';
import { useState, useRef, useEffect } from 'react';
import AppService from './AppService';
import Util from './Util';
import FooterComponent from './components/FooterComp';
import HeaderComp from './components/HeaderComp';
import MainComp from './components/MainComp';

const app = AppService.getInst(); 
const util = Util.getInst(); 

let urlAccepted: boolean = false;

function QuantaChat() {
    const gs = useGlobalState();

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
        app._connect(formData.userName, formData.roomName);
    };

    const disconnect = () => {
        app._disconnect();
    };

    const clear = () => {
        if (gs.connected) {
            app._clearMessages();
        } else {
            console.log("Not connected, cannot clear messages.");
        }
    };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
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
    
    // Update the send function to convert files to base64 before sending
    const send = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || !gs.connected) {
            console.log("Not connected or empty message with no attachments, not sending.");
            return;
        }
        
        let processedFiles: any = null;
        if (selectedFiles.length > 0) {
            try {
                console.log(`Sending message with ${selectedFiles.length} attachments`);
                
                // Convert all files to base64 format
                processedFiles = await Promise.all(
                    selectedFiles.map(file => util.fileToBase64(file))
                );
                
            } catch (error) {
                console.error("Error processing attachments:", error);
            }
        } 
        // Send message without attachments
        app._send(message.trim(), processedFiles);
        
        setMessage(''); // Clear the message input after sending
        setSelectedFiles([]); // Clear the selected files after sending
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    let participants = null;
    if (gs.connected) {
        if (gs.participants.size === 0) {
            participants = `You're alone right now.`;
        }
        else {
            participants = `Members: You, ${Array.from(gs.participants).sort().join(', ')}`
        }
    }
    else {
        participants = '';
    }
    
    useEffect(() => {
        if (urlAccepted) return;
        urlAccepted = true; // Prevents multiple executions

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
                app._connect(userNameParam, roomNameParam);
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
            
            <HeaderComp
                participants={participants}
                isConnected={gs.connected}
                formData={formData}
                handleInputChange={handleInputChange}
                connect={connect}
                disconnect={disconnect}
                clear={clear}
                gsUserName={gs.userName}
                gsRoomName={gs.roomName}
            />

            <MainComp 
                messages={gs.messages}
                currentUserName={gs.userName}
                toggleFullSize={toggleFullSize}
            />

            <FooterComponent 
                message={message}
                onMessageChange={handleMessageChange}
                textareaRef={textareaRef}
                selectedFiles={selectedFiles}
                onFileSelect={handleFileSelect}
                onSend={send}
                isConnected={gs.connected}
            />
            
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