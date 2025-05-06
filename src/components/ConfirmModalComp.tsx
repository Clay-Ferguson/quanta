import { app } from '../AppService';
import { useGlobalState } from '../GlobalState';
import Markdown from './MarkdownComp';

interface ConfirmationPromiseHandlers {
    resolve: (value: boolean) => void;
}

// A global variable to store our promise callbacks
let activeConfirmHandlers: ConfirmationPromiseHandlers | null = null;

// eslint-disable-next-line react-refresh/only-export-components
export function setConfirmHandlers(handlers: ConfirmationPromiseHandlers | null) {
    activeConfirmHandlers = handlers;
}

/**
 * Displays a modal confirmation dialog box with a message and two buttons: Cancel and OK. This modal is used to confirm user actions.
 */
export function ConfirmModalComp() {
    const gs = useGlobalState();
    if (!gs.confirmMessage) return null;
    
    const handleConfirm = (result: boolean) => {
        // Resolve the promise with the user's choice
        if (activeConfirmHandlers) {
            activeConfirmHandlers.resolve(result);
            setConfirmHandlers(null);
        }
        app.closeConfirm();
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
                        className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
                        onClick={() => handleConfirm(false)}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={() => handleConfirm(true)}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}