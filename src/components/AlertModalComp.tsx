import { app } from '../AppService';
import { useGlobalState } from '../GlobalState';
import Markdown from './MarkdownComp';

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
                <div className="px-4 py-3 sm:px-6 border-gray-200 dark:border-gray-700 flex justify-end">
                    <button
                        type="button"
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onClick={app.closeAlert}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}