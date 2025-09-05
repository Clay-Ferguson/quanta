import { useLayoutEffect, useEffect, useRef } from 'react';
import AttachmentComp from '../../../../client/components/AttachmentComp';
import Markdown from '../../../../client/components/MarkdownComp';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTriangleExclamation, faCertificate, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useGlobalState } from '../ChatTypes';
import {util} from '../../../../client/Util';
import { scrollEffects } from '../../../../client/ScrollEffects';
import AvatarImageComp from '../../../../client/components/AvatarImageComp';
import { ChatMessage, Contact, MessageStates } from '../../../../common/types/CommonTypes';
import appMessages from '../AppMessages';
import appUsers from '../../../../client/AppUsers';

declare const ADMIN_PUBLIC_KEY: string; 

interface MainCompProps {
    id: string;
    tag: any;
    messages: ChatMessage[] | undefined;
}

/**
 * This is the main chat log component. It has smart scrolling where it will auto-scroll new messages come in, but if the user  
 * has scrolled up to read some text, and it not currently end-scrolled, then when new messages come in it will not scroll down automatically,
 * so it won't interrupt them while they're reading something at a non-end scroll location.
 */
export default function MessagesComp({ id, tag, messages }: MainCompProps) {
    const gs = useGlobalState();
    const messageCount = messages ? messages.length : 0;

    // For efficiency, we create a map of contacts by public key, so we can quickly look them up by public key.
    const contactsByPublicKey = new Map<string, Contact>();
    if (gs.chatContacts) {
        gs.chatContacts.forEach((contact) => {
            contactsByPublicKey.set(contact.publicKey, contact);
        });
    }

    const getDisplayName = (msg: ChatMessage) => {
        // If the message is from us, return our name.
        if (msg.sender === gs.userProfile!.name) {
            return gs.userProfile!.name;
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
        if (msg.sender === gs.userProfile!.name) {
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
                {messages!.map((msg) => {       
                    let title = `From:\n${msg.sender} - ${msg.publicKey}\nID: ${msg.id}`;
                    if (msg.state===MessageStates.SAVED) {
                        title += '\nSaved to server';
                    }
                    return (
                        <div 
                            key={'message-'+msg.id} 
                            className={`${msg.sender === gs.userProfile!.name ? 'bg-gray-700 border-l-4 ' 
                                : 'bg-gray-800 border-l-4 '}
                                ${msg.state!==MessageStates.SAVED ? 'border-red-500' : 
                            msg.sender === gs.userProfile!.name ? 'border-blue-500' : 
                                'border-transparent'
                        } p-3 rounded-md shadow-md flex flex-col`}
                        >
                            <div className="flex">
                                <div className="flex flex-col mr-3 min-w-[100px] text-left" title={title}>
                                    <div className="flex items-center" onClick={() => appUsers.showUserProfile(msg.publicKey!)}>
                                        {/* Avatar */}
                                        <div className="mr-2 flex-shrink-0">
                                            <AvatarImageComp
                                                publicKey={msg.publicKey!}
                                                name={msg.sender || ''}
                                            />
                                        </div>
                                        
                                        <div className="flex flex-col">
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
                                    </div>
                                </div>
                                <div className="w-0.5 bg-gray-400 self-stretch mx-2"></div>
                                <div className="flex-1 text-left text-gray-200">
                                    <Markdown markdownContent={msg.content} />
                                </div>
                                {/* Delete icon - visible for admin, always or else if you own the post */}
                                {(ADMIN_PUBLIC_KEY === gs.keyPair?.publicKey || msg.publicKey === gs.keyPair?.publicKey) && (
                                    <div className="flex items-start ml-2">
                                        <FontAwesomeIcon 
                                            icon={faTrash} 
                                            className="h-4 w-4 text-gray-500 hover:text-red-500 cursor-pointer transition-colors" 
                                            onClick={() => appMessages.deleteMessage(msg.id)}
                                            title="Delete message"
                                        />
                                    </div>
                                )}
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
                    )
                })}
            </div>
        </Tag>
    );
}