import { useState, useEffect, useRef } from 'react';
import { gd, useGlobalState } from '../GlobalState';
import Markdown from './MarkdownComp';

// Store resolution functions for active prompt dialogs
interface PromptPromiseHandlers {
    resolve: (value: string | null) => void;
}

// A global variable to store our promise callbacks
let activePromptHandlers: PromptPromiseHandlers | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function setPromptHandlers(handlers: PromptPromiseHandlers | null) {
    activePromptHandlers = handlers;
}

// eslint-disable-next-line react-refresh/only-export-components
export function promptModal(message: string, defaultValue: string = ''): Promise<string | null> {
    return new Promise((resolve) => {
        // Set the handlers for this prompt dialog
        setPromptHandlers({ resolve });
            
        // Display the prompt dialog
        gd({ type: 'openPrompt', payload: { 
            promptMessage: message,
            promptDefaultValue: defaultValue
        }});
    });
}

/**
 * Displays a modal prompt dialog box with a message and an input field. This modal is used to get generic user input.
 */

export function PromptModalComp() {
    const gs = useGlobalState();
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    
    // If promptMessage or defaultValue changes, update the input value
    useEffect(() => {
        if (gs.promptMessage && gs.promptDefaultValue) {
            setInputValue(gs.promptDefaultValue);
        }
    }, [gs.promptMessage, gs.promptDefaultValue]);
    
    // Focus the input when the modal appears
    useEffect(() => {
        if (gs.promptMessage && inputRef.current) {
            inputRef.current.focus();
            // Position cursor at the end
            inputRef.current.selectionStart = inputRef.current.value.length;
        }
    }, [gs.promptMessage]);
    
    if (!gs.promptMessage) return null;
    
    const handlePromptResponse = (result: boolean) => {
        // Resolve the promise with the user's input or null if canceled
        if (activePromptHandlers) {
            activePromptHandlers.resolve(result ? inputValue : null);
            setPromptHandlers(null);
        }
        gd({ type: 'closePrompt', payload: { 
            promptMessage: null,
            promptDefaultValue: null
        }});
        // Reset the input value after closing
        setInputValue('');
    };
    
    // Handle Enter key press to submit
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handlePromptResponse(true);
        } else if (e.key === 'Escape') {
            handlePromptResponse(false);
        }
    };
    
    return (
        // Overlay with semi-transparent background that covers the entire screen
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            {/* Modal container with custom border width */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden border border-gray-300 dark:border-gray-600 [border-width:3px]">
                {/* Modal content */}
                <div className="px-4 py-4">
                    <div className="mb-4">
                        <Markdown markdownContent={gs.promptMessage} />
                    </div>
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                </div>
                
                {/* Modal footer with two buttons */}
                <div className="px-4 py-3 sm:px-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button
                        type="button"
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        onClick={() => handlePromptResponse(false)}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => handlePromptResponse(true)}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
