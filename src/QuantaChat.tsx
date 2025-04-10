import { useState } from 'react';
import FooterComponent from './components/FooterComp';
import HeaderComp from './components/HeaderComp';
import MainComp from './components/MainComp';

function QuantaChat() {
    
    const [fullSizeImage, setFullSizeImage] = useState<{
        src: string;
        name: string;
    } | null>(null);
    
    const toggleFullSize = (src: string, name: string) => {
        setFullSizeImage(fullSizeImage ? null : { src, name });
    };
    
    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            
            <HeaderComp/>
            <MainComp 
                toggleFullSize={toggleFullSize}
            />

            <FooterComponent/>
            
            {/* Full-size image viewer modal */}
            {fullSizeImage && (
                <div 
                    className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4 overflow-auto"
                    onClick={() => setFullSizeImage(null)}
                >
                    <div className="relative max-w-full max-h-full">
                        <button 
                            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 z-10"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFullSizeImage(null);
                            }}
                        >
                            ✕
                        </button>
                        <div className="bg-gray-800 p-3 rounded shadow-lg border border-gray-700">
                            <h3 className="text-center text-lg font-medium mb-2 text-gray-200">{fullSizeImage.name}</h3>
                            <img 
                                src={fullSizeImage.src} 
                                alt={fullSizeImage.name}
                                className="max-w-full max-h-[80vh] object-contain"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default QuantaChat;