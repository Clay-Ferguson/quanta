import FooterComp from '../components/FooterComp';
import HeaderComp from '../components/HeaderComp';
import ImageViewerComp from '../components/ImageViewerComp';
import MainComp from '../components/MainComp';
import { useGlobalState } from '../GlobalState';

export default function QuantaChatPage() {
    const gs = useGlobalState();
    let mainComp = null;

    // Show not connected message if user is not connected
    if (!gs.connected) {
        if (!gs.appInitialized || gs.connecting) {
            mainComp = null;
        }
        else {
            mainComp = (
                <main className="flex-grow overflow-y-auto p-4 bg-gray-900 flex items-center justify-center">
                    <div className="text-center p-8 bg-gray-800 rounded-lg shadow-lg max-w-md">
                        <h2 className="text-2xl font-bold text-blue-400 mb-4">Not Connected</h2>
                        <p className="text-gray-300 mb-2">Enter a room name in the field above and click "Join" to get started chatting.</p>
                        <p className="text-gray-400 text-sm">You'll be able to see messages and share files once you're connected to a room.</p>
                    </div>
                </main>
            );
        }
    }
    else {
        mainComp = (
            <MainComp id="chatLog"/>
        )
    }

    return (
        <div className="page-container">
            <HeaderComp/>
            {mainComp}
            <FooterComp/>
            <ImageViewerComp />
        </div>
    );
}