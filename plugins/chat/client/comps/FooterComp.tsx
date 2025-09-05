import React from 'react';
import { useState, useRef, useEffect } from 'react';
import {util} from '../../../../client/Util';
import { useGlobalState } from '../ChatTypes';
import appMessages from '../AppMessages';

/**
 * Footer component for the chat application. It includes a textarea for typing messages,
 * a button to attach files, and a send button. It also handles file selection and pasting
 * images/files from the clipboard.
 */
export default function FooterComp() {
    const [message, setMessage] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [filePreviews, setFilePreviews] = useState<{url: string, isImage: boolean}[]>([]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const gs = useGlobalState();

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
    
    // Generate previews when files are selected
    useEffect(() => {
        // Clean up previous preview URLs to avoid memory leaks
        filePreviews.forEach(preview => URL.revokeObjectURL(preview.url));
        
        const newPreviews = selectedFiles.map(file => {
            const url = URL.createObjectURL(file);
            const isImage = file.type.startsWith('image/');
            return { url, isImage };
        });
        
        setFilePreviews(newPreviews);
        
        // Cleanup when component unmounts
        return () => {
            newPreviews.forEach(preview => URL.revokeObjectURL(preview.url));
        };
    }, 
    // WARNING: Do not let the linter convince you to add selectedFiles to the dependency array,
    // as this will cause an infinite loop (mainly only failing on Firefox, but it's a problem)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedFiles]);
    
    // Add clipboard paste handler
    useEffect(() => {
        const handlePaste = (e: ClipboardEvent) => {
            // Skip if not connected
            if (!gs.chatConnected) return;
            
            // Skip if nowhere to deliver
            const nowhereToDeliver = (gs.chatParticipants==null || gs.chatParticipants.size === 0) && !gs.chatSaveToServer;
            if (nowhereToDeliver) return;
            
            if (e.clipboardData && e.clipboardData.files.length > 0) {
                e.preventDefault();
                
                const filesArray = Array.from(e.clipboardData.files);
                if (filesArray.length > 0) {
                    // Add pasted files to existing files
                    setSelectedFiles(prev => [...prev, ...filesArray]);
                }
            }
        };

        // Add event listener to the document (not just the textarea)
        document.addEventListener('paste', handlePaste);
        
        // Clean up
        return () => {
            document.removeEventListener('paste', handlePaste);
        };
    }, [gs.chatConnected, gs.chatParticipants, gs.chatSaveToServer]);
    
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
                // Add new files to existing files instead of replacing them
                setSelectedFiles(prev => [...prev, ...filesArray]);
            } catch (error) {
                console.error("Error processing files:", error);
            }
        }
    };
    
    const removeFile = (index: number) => {
        setSelectedFiles(prev => {
            const newFiles = [...prev];
            newFiles.splice(index, 1);
            return newFiles;
        });
    };
    
    const send = async () => {
        if ((!message.trim() && selectedFiles.length === 0) || !gs.chatConnected) {
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
        await appMessages.sendMessage(message.trim(), processedFiles);
        
        setMessage(''); 
        setSelectedFiles([]); 
        
        // Reset the file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }

    const nowhereToDeliver = (gs.chatParticipants==null || gs.chatParticipants.size === 0) && !gs.chatSaveToServer;
    let textareaPlaceholder = '';
    if (gs.chatConnected) {
        if (nowhereToDeliver) {
            textareaPlaceholder = "No one is in this room, to send messages. Select 'Save Messages on Server' option in Settings to send now."
        }
        else {
            textareaPlaceholder = "Type your message... (CTRL+V to paste images/files from clipboard)";
        }
    }
    else {
        textareaPlaceholder = "Join a room to start chatting...";
    }

    return (
        <footer className="w-full bg-gray-800 p-4 flex flex-col shadow-md border-t border-gray-400">
            <div id="inputsDiv" className="flex items-center w-full">
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
                    placeholder={textareaPlaceholder} 
                    className="flex-grow rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-800"
                    disabled={!gs.chatConnected || nowhereToDeliver}
                />
                <button 
                    className="bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md px-4 py-2 ml-2 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                    onClick={fileSelect}
                    disabled={!gs.chatConnected}
                    title={selectedFiles.length === 0 ? 'Attach files' : `${selectedFiles.length} file(s) attached`}
                >
                    {selectedFiles.length ? `📎(${selectedFiles.length})` : '📎'}
                </button>
                <button 
                    className="bg-blue-600 hover:bg-blue-700 text-gray-100 rounded-md px-4 py-2 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={send}
                    disabled={!gs.chatConnected}
                >
                    Send
                </button>
            </div>
            
            {/* Attachment preview area */}
            {selectedFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3 w-full">
                    {selectedFiles.map((file, index) => (
                        <div 
                            key={index} 
                            className="relative bg-gray-700 rounded-md p-2 flex flex-col items-center max-w-[180px]"
                        >
                            {filePreviews[index]?.isImage ? (
                                <img 
                                    src={filePreviews[index]?.url} 
                                    alt={file.name}
                                    className="h-32 w-32 object-contain rounded-md"
                                />
                            ) : (
                                <div className="h-32 w-32 flex items-center justify-center bg-gray-800 rounded-md text-gray-100">
                                    <span className="text-4xl">📄</span>
                                </div>
                            )}
                            <div className="mt-1 text-xs text-gray-200 truncate max-w-full">
                                {file.name.length > 15 ? file.name.slice(0, 12) + '...' : file.name}
                            </div>
                            <div className="text-xs text-gray-400">{util.formatFileSize(file.size)}</div>
                            <button 
                                onClick={() => removeFile(index)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600"
                                title="Remove file"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </footer>
    );
};
