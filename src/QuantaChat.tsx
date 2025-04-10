import { useGlobalState } from './GlobalState';
import { useState, useRef, useEffect } from 'react';
import AppService from './AppService';
import Util from './Util';
import FooterComponent from './components/FooterComp';
import HeaderComp from './components/HeaderComp';
import MainComp from './components/MainComp';

const app = AppService.getInst(); 
const util = Util.getInst(); 

function QuantaChat() {
    const gs = useGlobalState();

    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    
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

    // const disconnect = () => {
    //     app._disconnect();
    // };

    // const clear = () => {
    //     if (gs.connected) {
    //         app._clearMessages();
    //     } else {
    //         console.log("Not connected, cannot clear messages.");
    //     }
    // };
    
    const handleFileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const toggleFullSize = (src: string, name: string) => {
        setFullSizeImage(fullSizeImage ? null : { src, name });
    };

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
        await app._send(message.trim(), processedFiles);
        
        setMessage(''); 
        setSelectedFiles([]); 
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
    
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
            
            <HeaderComp/>

            <MainComp 
                messages={gs.messages}
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