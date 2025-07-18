import { gd, useGlobalState } from '../GlobalState';
import Markdown from './MarkdownComp';

interface ConfirmationPromiseHandler {
    resolve: (value: boolean) => void;
}

// A global variable to store our promise callbacks
let activeConfirmHandler: ConfirmationPromiseHandler | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function setConfirmHandler(handler: ConfirmationPromiseHandler | null) {
    activeConfirmHandler = handler;
}

// eslint-disable-next-line react-refresh/only-export-components
export function confirmModal(message: string): Promise<boolean> {
    return new Promise((resolve) => {
        // Set the handlers for this confirmation dialog
        setConfirmHandler({ resolve });
            
        // Display the confirmation dialog
        gd({ type: 'openConfirm', payload: { 
            confirmMessage: message
        }});
    });
}

/**
 * Displays a modal confirmation dialog box with a message and two buttons: Cancel and OK. This modal is used to confirm user actions.
 */
export function ConfirmModalComp() {
    const gs = useGlobalState();
    if (!gs.confirmMessage) return null;
    
    const closeConfirmModal = (result: boolean) => {
        // Resolve the promise with the user's choice
        if (activeConfirmHandler) {
            activeConfirmHandler.resolve(result);
            setConfirmHandler(null);
        }
        gd({ type: 'closeConfirm', payload: { 
            confirmMessage: null,
        }});
    };
    
    return (
        // Overlay with semi-transparent background that covers the entire screen
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            {/* Modal container with custom border width */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden border border-gray-300 dark:border-gray-600 [border-width:3px]">
                {/* Modal content - scrollable */}
                <div className="px-4 py-4 max-h-[50vh] overflow-y-auto">
                    <Markdown markdownContent={gs.confirmMessage} />
                </div>
                
                {/* Modal footer with two buttons */}
                <div className="px-4 py-3 sm:px-6 border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                    <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => closeConfirmModal(false)}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="btn-primary"
                        onClick={() => closeConfirmModal(true)}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}