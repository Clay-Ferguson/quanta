# Quanta Chat User Guide

## About Quanta Chat

The Quanta Chat extension implements a Peer-to-Peer capable WebRTC-based Chat Web App.

![Settings Page](img/chat-window.png)

## Features

* Basic chat room with a scrolling window of messages.
* Anyone can join any room. Rooms are created on demand and owned by no one.
* Similar to Nostr, a Public Key is your identity, but you can also choose a username, avatar, and description.
* Messages can be simple text or text and file attachments
* Markdown is supported
* All attached files are downloadable (making this app able to function as a rudimentary "File Sharing App")
* Uses Crypto Keys and Digital Signatures to authenticate all messages
* Ability import/export your Key Pair to have same identity on different devices.
* Contact List lets you define what users (Public Keys) you trust.
* To enable pure Peer-to-Peer mode, simply turn off the "Save on Server" option in Settings Panel. 
* Admin features include ability to block users by Public Key, and any message, or any attachment from any user. Admins can also easily view *all* recently uploaded attachments to find/delete any unwanted kinds of content.

## Joining a Chat Room

To join a chat room, simply enter the room name in the input field and click the "Join" button. You will be taken to the chat room where you can start chatting with other users that are in that room. Rooms are created on demand, and no one "owns" any room. If you want a private room for you and your friends, just create a room with a unique name and keep the name secret.

If you have the "Save to Server" option enabled then you're in non-P2P mode and you can post messages to the room which will be saved on the server, so that when other users join the room they'll see all those messages. If you're in P2P mode, you can only send to people who are online live with you at the same time. 

## Sending Messages

To send a message, simply type your message in the input field and press the "Send" button. Your message will go out in realtime to all other users who are in the same room. You can also use markdown syntax to format your messages. The attachment button is fairly standard and works the same as in other web apps, where you can pick files from your device and they will get attached to a chat message along with the chat text.

*Note: Markdown formatting is supported for chat messages*

## Leaving a Room

To leave a room, simply click the "Leave" button. You will be taken back to the main screen where you can join another room or create a room.

## Your Identity

If you're not familiar with `Public Key` stuff don't worry you can ignore this section. The app does everything automatically, but for more technical users, this section will be helpful.

Your unique identity is represented by your Public Key (a Cryptographic Key), which the app will automatically create for you and use to sign all messages you post. If you don't know much about cryptographic communications, all this means is that it's impossible for anyone to impersonate you, while also ensuring that your messages are authentic and have not been tampered with. 

So there can be any number of users who choose to use "Jack" as their username, and that's fine, there's no system enforcing user name uniqueness, so if you want to be sure you're talking to the person you know as "Jack" all you need to do is add their Public Key to your Contacts List, and automatically their posts alway show up with a "Gold Certificate" icon so you can be sure it's from from who you think it is, and all this can be done, without a central server.

Similar to other decentralized or Peer-to-Peer apps (like Nostr for example), your identity is considered to be your public key, and your messages are signed with your private key. In fact since Quanta Chat uses the same security algorithms as Nostr, your Quanta Chat key will be a valid Nostr key, even if you're not using Nostr. 

![Settings Page](img/about-you.png)

## Key Management

You can import a Key Pair simply by entering your Private Key, or generate a new Key Pair.

![Settings Page](img/identity-keys.png)

## Contact List

As mentioned already, if you want to verify that messages you receive are from a specific person, you can add them to your contacts list.  You can also add a nickname for them, so you can easily identify them in the chat room, by your own nickname. Any time a message is displayed, the authenticity is always checked via cryptographic signature, and if the sender is not in your contacts list, you will see a warning icon next to their name, just meaning you may not know them.

![Contacts List](img/contacts.png)

## Avatars

Each user can upload an Avatar image, set their User Name, and Description in their settings page. Then other users can always click that avatar image, wherever it appears, to display this information.

![Settings Page](img/user-profile.png)

## Your Room History 

You can view the rooms you've visited before using the "Rooms" button.

![Settings Page](img/rooms.png)

## Room's Current Members

You can view who's in your current room using the "Info" button.

![Settings Page](img/room-info.png)

