import { gd, useGlobalState } from '../GlobalState';
import Markdown from './MarkdownComp';

interface AlertPromiseHandler {
    resolve: () => void;
}

// A global variable to store our promise callbacks
let activeAlertHandler: AlertPromiseHandler | null = null;

function closeAlertModal() {
    // Resolve the promise with the user's choice
    if (activeAlertHandler) {
        activeAlertHandler.resolve();
        setAlertHandler(null);
    }
    gd({ type: 'closeAlert', payload: { 
        modalMessage: null,
    }});
};

// eslint-disable-next-line react-refresh/only-export-components
export function setAlertHandler(handler: AlertPromiseHandler | null) {
    activeAlertHandler = handler;
}

// eslint-disable-next-line react-refresh/only-export-components
export function alertModal(message: string, timeout: number=0): Promise<void> {
    const promise = new Promise<void>((resolve) => {
        // Set the handlers for this confirmation dialog
        setAlertHandler({ resolve });
            
        console.log("Alert: " + message);
        gd({ type: 'openAlert', payload: { 
            modalMessage: message,
            showModalButton: timeout === 0,
        }});
    });

    // if a non-zero timeout is passed, we will not be showing the button but will close the modal automatically
    // after the timeout
    if (timeout > 0) {
        setTimeout(() => {
            closeAlertModal();
        }, timeout);
    }

    return promise;
}

/**
 * Displays a modal alert dialog box with a message.
 */
export default function AlertModalComp() {
    const gs = useGlobalState();
    if (!gs.modalMessage) return null;

    return (
        // Overlay with semi-transparent background that covers the entire screen
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            {/* Modal container with custom border width */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md mx-4 overflow-hidden border border-gray-300 dark:border-gray-600 [border-width:3px]"> 
                {/* Modal content - scrollable */}
                <div className="px-4 py-4 max-h-[50vh] overflow-y-auto">
                    <Markdown markdownContent={gs.modalMessage} />
                </div>
                
                {/* Modal footer */}
                {gs.showModalButton && <div className="px-4 py-3 sm:px-6 border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={closeAlertModal}
                    >
                        OK
                    </button>
                </div>}
            </div>
        </div>
    );
}