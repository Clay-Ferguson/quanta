import React from 'react';
import { useGlobalState } from '../GlobalState';
import { useState, useRef, useEffect } from 'react';
import {app} from '../AppService';
import {util} from '../Util';

const FooterComponent: React.FC = () => {
    const gs = useGlobalState();

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
    
    const messageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
    };
    
    const fileSelect = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
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
        <footer className="w-full bg-gray-800 p-4 flex items-center flex-shrink-0 shadow-md border-t border-blue-400/30">
            {/* Hidden file input element */}
            <input 
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                multiple
                onChange={handleFiles}
            />

            <textarea 
                ref={textareaRef}
                value={message}
                onChange={messageChange}
                placeholder={gs.connected ? "Type your message..." : "Join a room to start chatting..."} 
                className="flex-grow rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-800"
                disabled={!gs.connected}
            />
            <button 
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md px-4 py-2 ml-2 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                onClick={fileSelect}
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
    );
};

export default FooterComponent;