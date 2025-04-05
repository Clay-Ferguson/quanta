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
                    {gs.messages.map((message, index) => (
                        <div 
                            key={index} 
                            className={`${message.sender === gs.userName ? 'bg-white' : 'bg-gray-200'} p-3 rounded-md shadow-sm`}
                        >
                            {message.sender}: {message.content}
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