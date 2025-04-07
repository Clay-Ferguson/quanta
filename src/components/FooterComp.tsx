import React, { RefObject } from 'react';

interface FooterComponentProps {
  message: string;
  onMessageChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  selectedFiles: File[];
  onFileSelect: () => void;
  onSend: () => void;
  isConnected: boolean | undefined;
}

const FooterComponent: React.FC<FooterComponentProps> = ({
    message,
    onMessageChange,
    textareaRef,
    selectedFiles,
    onFileSelect,
    onSend,
    isConnected
}) => {
    return (
        <footer className="w-full bg-gray-800 p-4 flex items-center flex-shrink-0 shadow-md border-t border-blue-400/30">
            <textarea 
                ref={textareaRef}
                value={message}
                onChange={onMessageChange}
                placeholder="Type your message..." 
                className="flex-grow rounded-md bg-gray-700 border-gray-600 text-gray-100 shadow-sm p-2 min-h-[40px] max-h-[200px] resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:bg-gray-800"
                disabled={!isConnected}
            />
            <button 
                className="bg-gray-700 hover:bg-gray-600 text-gray-100 rounded-md px-4 py-2 ml-2 border border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-gray-700"
                onClick={onFileSelect}
                disabled={!isConnected}
                title={selectedFiles.length === 0 ? 'Attach files' : `${selectedFiles.length} file(s) attached`}
            >
                {selectedFiles.length ? `📎(${selectedFiles.length})` : '📎'}
            </button>
            <button 
                className="bg-blue-600 hover:bg-blue-700 text-gray-100 rounded-md px-4 py-2 ml-2 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={onSend}
                disabled={!isConnected}
            >
        Send
            </button>
        </footer>
    );
};

export default FooterComponent;