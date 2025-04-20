import { useLayoutEffect, useEffect, useRef } from 'react';
import AttachmentComp from './AttachmentComp';
import { ChatMessage } from '../AppServiceTypes';
import Markdown from './MarkdownComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCertificate } from '@fortawesome/free-solid-svg-icons';
import { useGlobalState } from '../GlobalState';

// Static map to store scroll positions for different instances
const scrollPositions = new Map<string, number>();

interface MainCompProps {
    id: string;
}

// NOTE: This is the main chat log component. It has smart scrolling where it will auto-scroll new messages come in, but if the user  
// has scrolled up to read some text, and it not currently end-scrolled, then when new messages come in it will not scroll down automatically,
// so it won't interrupt them while they're reading something at a non-end scroll location.
export default function MainComp({ id }: MainCompProps) {
    const gs = useGlobalState();
    const chatLogRef = useRef<HTMLDivElement>(null);
    const messageCount = gs.messages ? gs.messages.length : 0;
    const userScrolledRef = useRef(false);
    
    const formatMessageTime = (msg: ChatMessage) => {
        return new Date(msg.timestamp).toLocaleDateString('en-US', { 
            month: '2-digit', 
            day: '2-digit', 
            year: '2-digit' 
        })+" "+
        new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    // Layout effect ensures scrolling happens before browser paint, which prevents any visible flicker
    useLayoutEffect(() => {
        if (chatLogRef.current && messageCount > 0) {
            const savedPosition = scrollPositions.get(id);
            if (savedPosition !== undefined) {
                // Restore previous scroll position if available
                chatLogRef.current.scrollTop = savedPosition;
            } else {
                // Default to scrolling to bottom
                chatLogRef.current.scrollTop = chatLogRef.current.scrollHeight;
            }
        }
    }, [messageCount, id]);

    // Handle scroll events to save position
    useEffect(() => {
        const chatLog = chatLogRef.current;
        if (!chatLog) return;

        const handleScroll = () => {
            if (!chatLog) return;
            
            // Only save scroll position if user has manually scrolled (not at the bottom)
            const isAtBottom = chatLog.scrollHeight - chatLog.scrollTop <= chatLog.clientHeight + 50;
            
            if (!isAtBottom) {
                userScrolledRef.current = true;
                scrollPositions.set(id, chatLog.scrollTop);
            } else {
                // If user scrolls to bottom, reset the userScrolled flag
                userScrolledRef.current = false;
                scrollPositions.delete(id);
            }
        };

        chatLog.addEventListener('scroll', handleScroll);
        
        return () => {
            chatLog.removeEventListener('scroll', handleScroll);
        };
    }, [id]);

    return (
        <main 
            id={id} 
            ref={chatLogRef} 
            className="flex-grow overflow-y-auto p-4 bg-gray-900"
        >
            <div className="space-y-3 max-w-full">
                {gs.messages!.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`${msg.sender === gs.userName ? 'bg-gray-700 border-l-4 border-blue-500' 
                            : 'bg-gray-800 border-l-4 border-transparent'} p-3 rounded-md shadow-md flex flex-col`}
                    >
                        <div className="flex">
                            <div className="flex flex-col mr-3 min-w-[100px] text-left">
                                <div className="flex items-center">
                                    <span className={`flex items-center ${msg.trusted ? 'text-yellow-400' : 'text-orange-500'}`}>
                                        {msg.trusted ? (
                                            <FontAwesomeIcon icon={faCertificate} className="h-4 w-4 mr-1.5" />
                                        ) : (
                                            <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 mr-1.5" />
                                        )}
                                    </span>
                                    <span className="font-semibold text-sm text-blue-400">{msg.sender}</span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {formatMessageTime(msg)}
                                </span>
                            </div>
                            <div className="w-0.5 bg-gray-400 self-stretch mx-2"></div>
                            <div className="flex-1 text-left text-gray-200">
                                <Markdown markdownContent={msg.content} />
                            </div>
                        </div>
            
                        {/* Attachments section */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                    {msg.attachments.map((att, idx) => (
                                        <AttachmentComp 
                                            key={idx}
                                            attachment={att} 
                                            index={idx} 
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </main>
    );
}