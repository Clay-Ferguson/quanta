
import { app } from '../../../client/AppService';
import appUsers from '../../../client/AppUsers';
import { promptModal } from '../../../client/components/PromptModalComp';
import { ChatPageNames } from './ChatTypes';

/**
 * Chat admin buttons component for managing chat-related admin features.
 */
export function ChatAdminPageComp() {
    const getRoomInfo = async () => {
        app.goToPage(ChatPageNames.roomsAdmin);
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