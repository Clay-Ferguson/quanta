import { useLayoutEffect, useEffect, useRef } from 'react';
import AttachmentComp from './AttachmentComp';
import { ChatMessage, Contact } from '../AppServiceTypes';
import Markdown from './MarkdownComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCertificate } from '@fortawesome/free-solid-svg-icons';
import { useGlobalState } from '../GlobalState';
import {util} from '../Util';
import { scrollEffects } from '../ScrollEffects';

interface MainCompProps {
    id: string;
    tag: any;
    messages: ChatMessage[] | undefined;
}

// NOTE: This is the main chat log component. It has smart scrolling where it will auto-scroll new messages come in, but if the user  
// has scrolled up to read some text, and it not currently end-scrolled, then when new messages come in it will not scroll down automatically,
// so it won't interrupt them while they're reading something at a non-end scroll location.
export default function MessagesComp({ id, tag, messages }: MainCompProps) {
    const gs = useGlobalState();
    const messageCount = messages ? messages.length : 0;

    // For efficiency, we create a map of contacts by public key, so we can quickly look them up by public key.
    const contactsByPublicKey = new Map<string, Contact>();
    if (gs.contacts) {
        gs.contacts.forEach((contact) => {
            contactsByPublicKey.set(contact.publicKey, contact);
        });
    }

    const getDisplayName = (msg: ChatMessage) => {
        // If the message is from us, return our name.
        if (msg.sender === gs.userName) {
            return gs.userName;
        } 
        // If the sender is in our contact list, use their alias. Otherwise, use their public key.
        const contact = contactsByPublicKey.get(msg.publicKey!);
        if (contact) {
            return contact.alias;
        }
        return msg.sender
    }

    const isTrusted = (msg: ChatMessage) => {
        // If the message is from us, return true.
        if (msg.sender === gs.userName) {
            return true;
        } 
        // If the sender is in our contact list, return true. Otherwise, return false.
        return contactsByPublicKey.has(msg.publicKey!);
    }

    const elmRef = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => scrollEffects.layoutEffect(elmRef, true), [messageCount]);
    useEffect(() => scrollEffects.effect(elmRef), []);

    // Note; This looks silly but it's required to have the upper case tag name.
    const Tag = tag;
    
    return (
        <Tag 
            id={id} 
            ref={elmRef} 
            className="flex-grow overflow-y-auto p-4 bg-gray-900"
        >
            <div className="space-y-3 max-w-full">
                {messages!.map((msg, index) => (
                    <div 
                        key={index} 
                        className={`${msg.sender === gs.userName ? 'bg-gray-700 border-l-4 border-blue-500' 
                            : 'bg-gray-800 border-l-4 border-transparent'} p-3 rounded-md shadow-md flex flex-col`}
                    >
                        <div className="flex">
                            <div className="flex flex-col mr-3 min-w-[100px] text-left" title={"From: \n\n"+msg.sender+"\n\n"+msg.publicKey}>
                                <div className="flex items-center">
                                    <span className={`flex items-center ${isTrusted(msg) ? 'text-yellow-400' : 'text-orange-500'}`}>
                                        {isTrusted(msg) ? (
                                            <FontAwesomeIcon icon={faCertificate} className="h-4 w-4 mr-1.5" />
                                        ) : (
                                            <FontAwesomeIcon icon={faTriangleExclamation} className="h-4 w-4 mr-1.5" />
                                        )}
                                    </span>
                                    <span className="font-semibold text-sm text-blue-400">{getDisplayName(msg)}</span>
                                </div>
                                <span className="text-xs text-gray-400">
                                    {util.formatMessageTime(msg)}
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
        </Tag>
    );
}