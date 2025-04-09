import { useGlobalState, useGlobalDispatch } from '../GlobalState';

import Markdown from "./MarkdownComp";

// const app = AppService.getInst(); 

const UserGuidePage: React.FC = () => {
    const gs = useGlobalState();
    const gd = useGlobalDispatch();

    // todo-0: we need a global (on app object?) method to set the page, which just takes the arg string of page name.
    // todo-0: also this back button needs to be somehow at the top of all pages that aren't the main page.
    const back = () => {
        gs.page = 'QuantaChat'; 
        gd({ type: 'setPage', payload: gs });
    };

    return (
        <div className="h-screen flex flex-col w-screen min-w-full bg-gray-900 text-gray-200 border border-blue-400/30">
            <header className="w-full bg-gray-800 text-gray-100 p-4 flex-shrink-0 flex justify-between items-center shadow-md border-b border-blue-400/30">
                <div id="settingsLogo" className="flex-1 flex items-center">
                    <div className="mr-3">
                        <img 
                            src="/logo-100px-tr.jpg" 
                            alt="Quanta Chat Logo" 
                            className="h-auto object-contain border border-blue-400/30 rounded"
                        />
                    </div>
                    <div className="overflow-hidden">
                        <h2 className="font-semibold text-blue-400">Quanta Chat</h2>
                        <h4 className="font-semibold text-gray-300 truncate">User Guide</h4>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <button className="btn-primary" onClick={back}>Back</button>
                </div>
            </header>
            <div id="userGuideContent" className="flex-grow overflow-y-auto p-4 bg-gray-900 flex justify-center">
                <div className="max-w-2xl w-full">
                    <Markdown markdownContent={`
## Joining a Chat Room

To join a chat room, simply enter the room name in the input field (and currently you need a username as well)
and click the "Connect" button. You will be taken to the chat room where you can start
chatting with other users. Rooms are created on demand, and no one "owns" any room. If you want a private room for you and your friends, 
just create a room with a unique name.

## Sending Messages

To send a message, simply type your message in the input field and press "Send" button. Your message will go out in realtime to all other
users who are in the same room. You can also use markdown syntax to format your messages.

## Leaving a Room

To leave a room, simply click the "Disconnect" button. You will be taken back to the main screen where you can join another room or create a new one.

## Enable Signatures

You can enable message signatures by clicking the "Settings" button. This will let you create a cryptographic signature for your messages, which will be
verified by other apps automatically. This is a great way to ensure that your messages are authentic and have not been tampered with, and that 
messages really come from you. Similar to other decentralized or Peer-to-Peer apps, your identity is a public key, and your messages are signed with your private key.

## Configure Contacts

If you want to verify that messages you recieve are from a specific person, you can add them to your contacts list. This will allow you to set their public key,
 and verify that messages you receive are from them. You can also add a nickname for them, so you can easily identify them in the chat room. Any time a message
 is display the authenticity is always checked via cryptographic signature, and if the sender is not in your contacts list, you will see a warning icon next to their name,
 or else you will see a green checkmark.
                    `}/>
                    <div className="h-20"></div> {/* Empty div for bottom spacing */}
                </div>
            </div>
        </div>
    );
};

export default UserGuidePage;
