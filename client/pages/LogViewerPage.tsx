import LogoBlockComp from '../components/LogoBlockComp';
import BackButtonComp from '../components/BackButtonComp';
import { useEffect, useState } from 'react';
import { util } from '../Util';
import * as ClientLogger from '../ClientLogger';
import { alertModal } from '../components/AlertModalComp';

/**
 * LogViewerPage component for viewing system logs
 */
export default function LogViewerPage() {
    const [logs, setLogs] = useState<string>('');
    
    useEffect(() => {
        util.resizeEffect();
        
        // Get logs on initial load
        refreshLogs();
    }, []);
    
    const refreshLogs = () => {
        const logText = ClientLogger.getLogsAsString();
        setLogs(logText);
    };
    
    const clearLogs = () => {
        if (confirm('Are you sure you want to clear all logs?')) {
            ClientLogger.clearLogs();
            refreshLogs();
        }
    };
     
    const copyToClipboard = () => {
        navigator.clipboard.writeText(logs)
            .then(async () => {
                await alertModal('Logs copied to clipboard');
            })
            .catch(err => {
                console.error('Failed to copy logs to clipboard', err);
            });
    };
    
    return (
        <div className="page-container pt-safe">
            <header className="app-header">
                <LogoBlockComp subText="Log Viewer"/>
                <div className="flex items-center space-x-4">
                    <BackButtonComp/>
                </div>
            </header>

            <div className="flex flex-col p-2 bg-gray-900 h-full">
                <div className="flex justify-between items-center mb-2">
                    <div className="text-sm text-gray-400">
                        System log records displayed in chronological order
                    </div>
                    <div className="flex space-x-2">
                        <button 
                            onClick={refreshLogs} 
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                            Refresh
                        </button>
                        <button 
                            onClick={copyToClipboard} 
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                        >
                            Copy
                        </button>
                        <button 
                            onClick={clearLogs} 
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                            Clear
                        </button>
                    </div>
                </div>
                
                <div className="flex-grow relative">
                    <textarea
                        className="absolute inset-0 w-full h-full bg-gray-800 text-gray-300 p-3 font-mono text-xs resize-none border border-gray-700 focus:outline-none focus:border-blue-500"
                        value={logs}
                        readOnly
                        style={{
                            overflowX: 'auto',
                            overflowY: 'auto',
                            whiteSpace: 'pre',
                            lineHeight: '1.4'
                        }}
                    />
                </div>
            </div>
        </div>
    );
}