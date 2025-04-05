import { useGlobalState } from './GlobalState';
import './App.css'

function QuantaChat() {
    const gs = useGlobalState();

    const participants = 'Participants: ' + Array.from(gs.participants).join(', ');
    return (
        <div className="h-screen flex flex-col w-screen min-w-full">
            <header className="w-full bg-blue-500 text-white p-4 flex-shrink-0">
                <h1 className="text-xl font-semibold">QuantaChat</h1>
                <h2 className="font-semibold">{participants}</h2>
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