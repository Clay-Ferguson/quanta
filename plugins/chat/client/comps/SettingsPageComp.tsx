import { useEffect, useState } from "react";
import { DBKeys, PanelKeys } from "../../../../client/AppServiceTypes";
import TitledPanelComp from "../../../../client/components/TitledPanelComp";
import { gd, useGlobalState } from "../ChatTypes";
import { idb } from "../../../../client/IndexedDB";
import { rtc } from "../WebRTC";
import appRooms from "../AppRooms";
import { alertModal } from "../../../../client/components/AlertModalComp";

export default function ChatSettingsPageComp() {
    const gs = useGlobalState();
    const [chatSaveToServer, setChatSaveToServer] = useState(false);
    const [chatDaysOfHistory, setChatDaysOfHistory] = useState('');
     
    async function persistGlobalValue(key: string, value: any) {
    // save to global state
        gd({ type: `persistGlobal-${key}`, payload: { 
            [key]: value
        }});
        // Save the keyPair to IndexedDB
        await idb.setItem(key, value);
    }

    const handleSaveToServerChange = (e: any) => {
        const isChecked = e.target.checked;
        setChatSaveToServer(isChecked);
        persistGlobalValue(DBKeys.chatSaveToServer, isChecked);
        rtc.setSaveToServer(isChecked);
    };
    
    const handleDaysOfHistoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setChatDaysOfHistory(value);
    };
    
    const saveDaysOfHistory = async () => {
        // Convert to number and save to global state
        const days = parseInt(chatDaysOfHistory);
        if (!isNaN(days) && days >= 0) {
            persistGlobalValue(DBKeys.chatDaysOfHistory, days);
            appRooms.runRoomCleanup();
            await alertModal(`Saved successfully.`);
        } else {
            await alertModal("Please enter a valid number of days (0 or greater)");
        }
    };

    useEffect(() => {    
        // Initialize chatSaveToServer from global state
        setChatSaveToServer(gs.chatSaveToServer || false);
            
        // Initialize chatDaysOfHistory from global state
        if (gs.chatDaysOfHistory !== undefined) {
            setChatDaysOfHistory(gs.chatDaysOfHistory.toString());
        }
    }, [gs.userProfile, gs.chatSaveToServer, gs.chatDaysOfHistory]);
    

    return (                
        <TitledPanelComp title="Chat Options" collapsibleKey={PanelKeys.settings_options}>               
            <div className="flex items-center justify-between">
                <div>
                    <label htmlFor="chatSaveToServer" className="text-sm font-medium text-blue-300 cursor-pointer">
                                            Sync Messages with Server
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                                            When enabled, your messages will be stored on the server. Otherwise, server is not used, and you can only send/recieve messages with other users who are online simultaneously with you.
                    </p>
                </div>
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="chatSaveToServer"
                        name="chatSaveToServer"
                        checked={chatSaveToServer}
                        onChange={handleSaveToServerChange}
                        className="h-5 w-5 rounded border-gray-600 text-blue-500 focus:ring-blue-500 bg-gray-700"
                    />
                </div>
            </div>
                                
            {/* Days of History Option */}
            <div className="mt-4 pt-4 border-t border-blue-400/20">
                <div className="mb-2">
                    <label htmlFor="chatDaysOfHistory" className="text-sm font-medium text-blue-300">
                        Days of History
                    </label>
                    <p className="text-xs text-gray-400 mt-1">
                        Messages older than this many days will be automatically deleted.
                    </p>
                </div>
                <div className="flex items-center space-x-3">
                    <input
                        type="number"
                        id="chatDaysOfHistory"
                        name="chatDaysOfHistory"
                        value={chatDaysOfHistory}
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
    );
}