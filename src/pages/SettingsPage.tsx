import React, { useState } from 'react';
import { useGlobalState } from '../GlobalState';
import AppService from '../AppService';

const app = AppService.getInst(); 

const SettingsPage: React.FC = () => {
    const gs = useGlobalState();
    const [showPrivateKey, setShowPrivateKey] = useState(false);

    const togglePrivateKey = () => {
        setShowPrivateKey(!showPrivateKey);
    };

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <header className="w-full bg-gray-800 text-gray-100 px-4 py-0 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="settingsLogo" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h3 className="font-semibold text-blue-400">Quanta Chat</h3>
                        <h5 className="font-semibold text-gray-300 truncate">Settings</h5>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button className="btn-primary" onClick={() => app.goToPage('QuantaChat')}>Back</button>
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                <div className="space-y-6 max-w-2xl mx-auto">
                    <h3 className="text-xl font-medium text-blue-400 border-b border-blue-400/30 pb-2">Your Identity Keys</h3>
                    
                    {/* Public Key Section */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-medium text-blue-300">Public Key</h4>
                            <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">Shareable</span>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border border-blue-400/20">
                            <code className="font-mono text-green-400 text-sm block">
                                {gs.keyPair?.publicKey || "No public key available"}
                            </code>
                        </div>
                    </div>

                    {/* Private Key Section */}
                    <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="text-lg font-medium text-blue-300">Private Key</h4>
                            <span className="text-xs bg-red-500/20 text-red-300 px-2 py-1 rounded">Secret</span>
                        </div>
                        <div className="mb-2">
                            <button 
                                onClick={togglePrivateKey}
                                className="text-sm px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 transition flex items-center"
                            >
                                <span>{showPrivateKey ? "Hide" : "Show"} Private Key</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    {showPrivateKey ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                    )}
                                </svg>
                            </button>
                        </div>
                        <div className="bg-gray-900 p-3 rounded border border-red-400/20">
                            {showPrivateKey ? (
                                <code className="font-mono text-red-400 text-sm block">
                                    {gs.keyPair?.privateKey || "No private key available"}
                                </code>
                            ) : (
                                <div className="text-gray-500 italic text-sm flex items-center justify-center p-2 border-dashed border border-gray-700 rounded">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                    Click "Show Private Key" to reveal
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-red-300 mt-2">
                            Warning: Keep your private key secret. Never share it with anyone.
                        </p>
                    </div>

                    <div className="space-y-3 mt-4">
                        <div className="flex space-x-4">
                            <button className="btn-primary" onClick={app._createIdentity}>Create New Identity</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
