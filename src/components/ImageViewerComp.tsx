import { useGlobalState } from '../GlobalState';
import {app} from '../AppService';

export default function ImageViewerComp() {
    // todo-0: we should always go thur 'app' to get global state.
    const gs = useGlobalState();

    return (
        <>
            {gs.fullSizeImage ? (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 overflow-auto"
                    onClick={() => app.setFullSizeImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <button 
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                app.setFullSizeImage(null);
                            }}
                        >
                            ✕
                        </button>
                        <div className="bg-gray-800 p-3 rounded shadow-lg border border-gray-700">
                            <img 
                                src={gs.fullSizeImage.src} 
                                alt={gs.fullSizeImage.name}
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            ) : null}
        </>
    );
};

