
import { app } from '../../AppService';
import appUsers from '../../AppUsers';
import { promptModal } from '../../components/PromptModalComp';

/**
 * Chat admin buttons component for managing chat-related admin features.
 */
export function ChatAdminPageComp() {
    const getRoomInfo = async () => {
        // todo-0: this needs to come from an enum AND from the plugin, we can't have this here.
        app.goToPage('RoomsAdminPage');
    };

    const blockUser = async () => {
        const pubKey = await promptModal("Enter User Public Key to block");
        if (!pubKey || pubKey.trim() === '') {
            return;
        }
        appUsers.blockUser(pubKey);
    }

    return (
        <>
            <button 
                onClick={() => app.goToPage('RecentAttachmentsPage')}
                className="btn-secondary mr-2"
                title="Recent Attachments"
            >
                Recent Attachments
            </button> 

            <button 
                onClick={getRoomInfo}
                className="btn-secondary mr-2"
            >
                Server Rooms
            </button>

            <button 
                className="btn-secondary mr-2"
                onClick={blockUser}
            >
                Block User
            </button>
        </>
    );
}