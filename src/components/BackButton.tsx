import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { PageNames } from "../AppServiceTypes";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft";
import { app } from "../AppService";

// We have this component because eventually we'll have a "stack" (history) of pages, and we want to be able to go back to the previous pages in order.

export default function BackButton() {
    return (
        <button 
            onClick={() => app.goToPage(PageNames.quantaChat)}
            className="p-2 bg-gray-500 text-white rounded-md flex items-center justify-center"
            title="Back"
        >
            <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5 mr-1" />Back
        </button>
    );
}