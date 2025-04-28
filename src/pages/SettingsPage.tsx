import { useState, useEffect, useRef } from 'react';
import { app } from '../AppService';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEye, faEyeSlash, faLock, faUpload, faUser } from '@fortawesome/free-solid-svg-icons';
import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useGlobalState } from '../GlobalState';
import TitledPanelComp from '../components/TitledPanelComp';
import { util } from '../Util';

export default function SettingsPage() {
    const gs = useGlobalState();
    const [showPrivateKey, setShowPrivateKey] = useState(false);
    const [userName, setUserName] = useState('');
    const [userDescription, setUserDescription] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [saveToServer, setSaveToServer] = useState(false);
    const [daysOfHistory, setDaysOfHistory] = useState('');
    const [storageInfo, setStorageInfo] = useState({
        usagePercentage: 0,
        quota: 0,
        usage: 0,
        remainingStorage: 0
    });
    
    const avatarInputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        const fetchStorageInfo = async () => {
            if (navigator.storage && navigator.storage.estimate) {
                const estimate: any = await navigator.storage.estimate();
                const remainingStorage = estimate.quota - estimate.usage;
                const usagePercentage = (estimate.usage / estimate.quota) * 100;
                
                setStorageInfo({
                    usagePercentage,
                    quota: estimate.quota,
                    usage: estimate.usage,
                    remainingStorage
                });
                
                console.log(`Storage: (${Math.round(usagePercentage)}% used). Quota: ${util.formatStorageSize(estimate.quota)}`);
            }
        };
        
        fetchStorageInfo();
    }, []);

    useEffect(() => {
        // Initialize the userName from global state when component mounts
        if (gs.userName) {
            setUserName(gs.userName);
        }
        
        // Initialize userDescription from global state
        if (gs.userDescription) {
            setUserDescription(gs.userDescription);
        }
        
        // Initialize avatar preview if available
        if (gs.userAvatar) {
            setAvatarPreview(gs.userAvatar.data);
        }
        
        // Initialize saveToServer from global state
        setSaveToServer(gs.saveToServer || false);
        
        // Initialize daysOfHistory from global state
        if (gs.daysOfHistory !== undefined) {
            setDaysOfHistory(gs.daysOfHistory.toString());
        }
    }, [gs.userName, gs.userDescription, gs.userAvatar, gs.saveToServer, gs.daysOfHistory]);

    const togglePrivateKey = () => {
        setShowPrivateKey(!showPrivateKey);
    };

    const handleSaveToServerChange = (e: any) => {
        const isChecked = e.target.checked;
        setSaveToServer(isChecked);
        app.setSaveToServer(isChecked);
    };
    
    const handleDaysOfHistoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setDaysOfHistory(value);
    };
    
    const saveDaysOfHistory = () => {
        // Convert to number and save to global state
        const days = parseInt(daysOfHistory);
        if (!isNaN(days) && days >= 0) {
            app.setDaysOfHistory(days);
            app.alert(`Saved successfully.`);
        } else {
            app.alert("Please enter a valid number of days (0 or greater)");
        }
    };
    
    const handleAvatarSelect = () => {
        if (avatarInputRef.current) {
            avatarInputRef.current.click();
        }
    };
    
    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            // Only accept image files
            if (!file.type.startsWith('image/')) {
                app.alert('Please select an image file for your avatar');
                return;
            }
            
            setAvatarFile(file);
            const previewUrl = URL.createObjectURL(file);
            setAvatarPreview(previewUrl);
        }
    };
    
    const previewUserInfo = async () => {
        await saveUserInfo(false);
        app.showUserProfile(gs.keyPair!.publicKey);
    };

    const saveUserInfo = async (showConfirm: boolean) => {
        let userAvatar = null;

        if (avatarFile) {
            // User selected a new file, convert it
            userAvatar = await util.fileToBase64(avatarFile);
        
            // Clean up the object URL
            if (avatarPreview) {
                URL.revokeObjectURL(avatarPreview);
            }
        } else if (gs.userAvatar) {
            // Create a new clean object with just the base properties
            userAvatar = gs.userAvatar
        }

        await app.saveUserInfo(userName, userDescription, userAvatar);
        if (showConfirm) {
            app.alert("Profile information saved successfully!");
        }
    };

    return (
        <div className="page-container">
            <header className="app-header">
                <LogoBlockComp subText="Settings"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>
            <div id="settingsContent" className="flex-grow overflow-y-auto p-4 bg-gray-900">
                {!gs.userName && ( 
                    <div className="mb-6 p-5 bg-blue-500/20 border-l-4 border-blue-500 rounded-md">
                        <h2 className="text-2xl font-bold text-blue-300 mb-2">Welcome to Quanta Chat!</h2>
                        <p className="text-lg text-gray-200">
                            Please enter a username below to get started. Your username helps identify you in conversations.
                        </p>
                    </div>
                )} 
                
                <div className="space-y-6 max-w-2xl mx-auto">
                    <TitledPanelComp title="About You">
                        <div className="flex flex-col md:flex-row gap-6 mb-4">
                            {/* Avatar section */}
                            <div className="flex flex-col items-center">
                                <div className="mb-3 w-36 h-36 relative">
                                    {avatarPreview ? (
                                        <img 
                                            src={avatarPreview} 
                                            alt="Your avatar" 
                                            className="w-36 h-36 object-cover rounded-full border-2 border-blue-400/30"
                                        />
                                    ) : (
                                        <div className="w-36 h-36 flex items-center justify-center bg-gray-800 rounded-full border-2 border-blue-400/30 text-gray-400">
                                            <FontAwesomeIcon icon={faUser} className="h-16 w-16" />
                                        </div>
                                    )}
                                    
                                    <button 
                                        onClick={handleAvatarSelect}
                                        className="absolute bottom-0 right-0 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-2 shadow-lg"
                                        title="Upload new avatar"
                                    >
                                        <FontAwesomeIcon icon={faUpload} className="h-4 w-4" />
                                    </button>
                                    
                                    {/* Hidden file input */}
                                    <input 
                                        type="file"
                                        ref={avatarInputRef}
                                        onChange={handleAvatarChange}
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                    />
                                </div>
                                <span className="text-xs text-gray-400">Click to upload an avatar</span>
                            </div>
                            
                            {/* User details section */}
                            <div className="flex-1">
                                <div className="mb-4">
                                    <label htmlFor="userName" className="block text-sm font-medium text-blue-300 mb-2">
                                        User Name
                                    </label>
                                    <input
                                        type="text"
                                        id="userName"
                                        name="userName"
                                        value={userName}
                                        onChange={(e) => setUserName(e.target.value)}
                                        className="w-full bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                                text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter your username"
                                    />
                                </div>
                                
                                <div className="mb-4">
                                    <label htmlFor="userDescription" className="block text-sm font-medium text-blue-300 mb-2">
                                        About Me
                                    </label>
                                    <textarea
                                        id="userDescription"
                                        name="userDescription"
                                        value={userDescription}
                                        onChange={(e) => setUserDescription(e.target.value)}
                                        rows={4}
                                        className="w-full bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                                text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                        placeholder="Tell others about yourself..."
                                    />
                                </div>
                            </div>
                        </div>
                        
                        <div className="flex justify-end">
                            <button 
                                className="btn-primary mr-2"
                                onClick={previewUserInfo}
                            >
                                Preview
                            </button>
                            <button 
                                className="btn-primary"
                                onClick={() => saveUserInfo(true)}
                            >
                                Save
                            </button>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Storage Space">
                        <div className="text-sm space-y-1">
                            <p className="flex items-center">
                                <span>Usage: </span>
                                <span className="text-lg font-bold ml-1">{Math.round(storageInfo.usagePercentage)}%</span>
                            </p>
                            <p>Total Space: {util.formatStorageSize(storageInfo.quota)}</p>
                            <p>Used Space: {util.formatStorageSize(storageInfo.usage)}</p>
                            <p>Remaining: {util.formatStorageSize(storageInfo.remainingStorage)}</p>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Options">               
                        <div className="flex items-center justify-between">
                            <div>
                                <label htmlFor="saveToServer" className="text-sm font-medium text-blue-300 cursor-pointer">
                                        Save Messages on Server
                                </label>
                                <p className="text-xs text-gray-400 mt-1">
                                        When enabled, your messages will be stored on the server. Otherwise, messages are only kept locally.
                                </p>
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="saveToServer"
                                    name="saveToServer"
                                    checked={saveToServer}
                                    onChange={handleSaveToServerChange}
                                    className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                                />
                            </div>
                        </div>
                            
                        {/* Days of History Option */}
                        <div className="mt-4 pt-4 border-t border-blue-400/20">
                            <div className="mb-2">
                                <label htmlFor="daysOfHistory" className="text-sm font-medium text-blue-300">
                                        Days of History
                                </label>
                                <p className="text-xs text-gray-400 mt-1">
                                        Messages older than this many days will be automatically deleted.
                                </p>
                            </div>
                            <div className="flex items-center space-x-3">
                                <input
                                    type="number"
                                    id="daysOfHistory"
                                    name="daysOfHistory"
                                    value={daysOfHistory}
                                    onChange={handleDaysOfHistoryChange}
                                    min="2"
                                    className="bg-gray-900 border border-blue-400/20 rounded-md py-2 px-3 
                                                  text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter days to keep"
                                />
                                <button 
                                    className="btn-primary"
                                    onClick={saveDaysOfHistory}
                                >
                                        Save
                                </button>
                            </div>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Your Identity Keys">
                        
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
                        <div className="bg-gray-800 rounded-lg p-4 border border-blue-400/20 shadow-md mt-4">
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
                                    <span className="h-4 w-4 ml-2" >
                                        {showPrivateKey ? (
                                            <FontAwesomeIcon icon={faEyeSlash} className="h-5 w-5" />
                                        ) : (
                                            <FontAwesomeIcon icon={faEye} className="h-5 w-5" />
                                        )}
                                    </span>
                                </button>
                            </div>
                            <div className="bg-gray-900 p-3 rounded border border-red-400/20">
                                {showPrivateKey ? (
                                    <code className="font-mono text-red-400 text-sm block">
                                        {gs.keyPair?.privateKey || "No private key available"}
                                    </code>
                                ) : (
                                    <div className="text-gray-500 italic text-sm flex items-center justify-center p-2 border-dashed border border-gray-700 rounded">
                                        <FontAwesomeIcon icon={faLock} className="h-5 w-5 mr-2" />
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
                                <button className="btn-primary" onClick={() => app._createIdentity(true)}>Create New Keys</button>
                                <button className="btn-primary" onClick={app._importKeyPair}>Import Keys</button>
                            </div>
                        </div>
                    </TitledPanelComp>

                    <TitledPanelComp title="Danger Zone">
                        <div className="bg-gray-800 rounded-lg p-4 border border-red-400/20 shadow-md">
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-lg font-medium text-red-300">Wipe All Data</h4>
                            </div>
                            <p className="text-sm text-gray-300 mb-4">
                                This will permanently delete all your chat data, contacts, and identity keys.
                            </p>
                            <button 
                                className="btn-danger"
                                onClick={async () => {
                                    if (await app.confirm("WARNING: This will completely wipe all your data including chat history, contacts, and identity keys. This operation cannot be undone. Are you sure?")) {
                                        app.clear();
                                    }
                                }}
                            >
                                Wipe All Data
                            </button>
                        </div>
                    </TitledPanelComp>
                </div>
            </div>
        </div>
    );
}
