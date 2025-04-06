import { useGlobalState, useGlobalDispatch } from './GlobalState';
import { useState } from 'react';
import './App.css'

function QuantaChat() {
    const gs = useGlobalState();
    const dispatch = useGlobalDispatch();
    
    // Local state for form fields
    const [formData, setFormData] = useState({
        userName: gs.userName || '',
        roomName: gs.roomName || ''
    });

    const handleInputChange = (e: any) => {
        const { id, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: value
        }));
    };

    const connect = () => {
        dispatch({ type: 'CONNECT', payload: { 
            userName: formData.userName, 
            roomName: formData.roomName 
        }});
    };

    const disconnect = () => {
        dispatch({ type: 'DISCONNECT'});
    };

    const participants = 'Participants: ' + Array.from(gs.participants).join(', ');
    return (
        <div className="h-screen flex flex-col w-screen min-w-full">
            <header className="w-full bg-blue-500 text-white p-4 flex-shrink-0 flex justify-between items-center">
                <div className="w-1/4">
                    <h1 className="text-xl font-semibold">QuantaChat</h1>
                    <h2 className="font-semibold">{participants}</h2>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="flex items-center">
                        <label htmlFor="userName" className="mr-2">Name:</label>
                        <input 
                            id="userName"
                            type="text" 
                            value={formData.userName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <div className="flex items-center">
                        <label htmlFor="roomName" className="mr-2">Room:</label>
                        <input 
                            id="roomName"
                            type="text" 
                            value={formData.roomName} 
                            onChange={handleInputChange}
                            className="rounded px-2 py-1 text-black w-28" 
                        />
                    </div>
                    <button 
                        onClick={connect}
                        className="bg-green-600 hover:bg-green-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Connect
                    </button>
                    <button 
                        onClick={disconnect}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-4 rounded"
                    >
                        Disconnect
                    </button>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto p-4">
                <div className="space-y-2 max-w-full">
                    {gs.messages.map((msg, index) => (
                        <div 
                            key={index} 
                            className={`${msg.sender === gs.userName ? 'bg-white' : 'bg-gray-200'} p-3 rounded-md shadow-sm flex`}
                        >
                            <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                <span className="font-semibold text-sm">{msg.sender}</span>
                                <span className="text-xs text-gray-500">
                                    {new Date(msg.timestamp).toLocaleDateString('en-US', { 
                                        month: '2-digit', 
                                        day: '2-digit', 
                                        year: '2-digit' 
                                    })} {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                            <div className="w-px bg-gray-300 self-stretch mx-2"></div>
                            <div className="flex-1 text-left">
                                {msg.content}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            <footer className="w-full bg-gray-300 p-4 flex items-center flex-shrink-0">
                <input type="text" placeholder="Type your message..." className="flex-grow rounded-md border-gray-400 shadow-sm p-2" />
                <button className="bg-green-500 text-white rounded-md px-4 py-2 ml-2">Send</button>
            </footer>
        </div>
    )
}

export default QuantaChat;