import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft";
import { app } from "../AppService";

export default function BackButtonComp() {
    return (
        <button 
            onClick={() => app.goBack()}
            className="p-2 bg-gray-500 text-white rounded-md flex items-center justify-center"
            title="Back"
        >
            <FontAwesomeIcon icon={faArrowLeft} className="h-5 w-5 mr-1" />Back
        </button>
    );
}