import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft";
import { gd, gs } from "../GlobalState";

function goBack() {
    const _gs = gs();
    if (_gs.pages && _gs.pages.length > 1) {
        // Remove the last page from the stack
        _gs.pages.pop();
    }
    gd({ type: 'setPage', payload: _gs });
}

/**
 * The universal back button component use in every page of the app. We maintain a stack of pages, so we can sort of pop
 * off the stack to go back. This is not a true back button, but it works for SPA app.
 */
export default function BackButtonComp() {
    return (
        <button 
            onClick={goBack}
            className="p-2 bg-gray-500 text-white rounded-md flex items-center justify-center"
            title="Back"
        >
            <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5 mr-1" />Back
        </button>
    );
}