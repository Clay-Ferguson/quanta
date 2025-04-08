# About QuantaChat

## [Try QuantaChat Now! --> http://chat.quanta.wiki](http://chat.quanta.wiki)

### Peer-to-Peer WebRTC-based Chat Web App

# Features

* Basic chat room with a scrolling window of messages from all participants in the room.
* Anyone can join any room using any name 
* Messages can be simple text or text and file attachments
* Markdown is supported in message text
* File attachments that are images are of course displayed in the GUI
* Attached images can be clicked on to get an enlarged view
* All attached files are downloadable (making this app able to function as a rudamentary "File Sharing App")
* All local storage is kept in your browsers storage space, private to your browser, but there's a "Clear" button you can use to wipe out your entire copy of an entire chat room that you or anyone else created. (Note: This only clears your own personal copy of the chat room)
* For ease of use you can create a shortcut like `http://chat.quanta.wiki/?user=bob&room=sports`, which has the username and room name embedded in the url and will automatically connect you to that room, when you visit the url.
* Technical Note: The data for chat rooms is saved using the `IndexedDB` API feature in Web Browsers, so the amount of storage allowed will currently be determined by the limitations of that storage space.

## To Run in IDE (VSCode)

```bash
yarn build && yarn start
```

## To Run the Server (PROD)

```bash
# Install Node first, then Yarn:
sudo npm install --global yarn

# if you don't have the project yet
git clone https://github.com/Clay-Ferguson/quanta-chat

# if you already have project, and want the latest 
git reset --hard HEAD
git pull --force

# install all packages (only need to run this once)
yarn install

# run to build and start the app.
sudo ./run-prod.sh
```

## Tech Stack

* TypeScript
* ReactJS
* TailwindCSS + SCSS
* NodeJS Express Server 
* Vite Builder
* Yarn Package Manager
* `simple-peer` + `webrtc-adapter` (NPM for P2P)

# How it Works (Technical)

## The Server

The command shown above starts the `Quanta Chat Server` which is a very tiny web server with just two simple purposes 1) To serve the single page of the app and 2) To run as a `Signaling Server` which allows the clients/peers/browses to find each other, which happens automatically.

## The Chat Client

The chat client itself is very simple. It allows users to enter their username and a chat room name, and then click "Connect" button, to join that room. Rooms are automatically created once they're needed by someone. The room's history of chat message is kept only on the peers (clients) and is saved in browser local storage. None of the messages are ever seen by the server, because they're sent directly to the browsers of all chat room participants in a peer-to-peer way.

If you refresh the browser you'll need to click "Connect" again to resume, but the chat room's history will still be there. Note, however that since this is a peer-to-peer system (with no central storage or database) any conversations that happen in a room while you're not online and in that room, will not be visible to you. There's currently no strategy for syncing messages `across` all users that have ever participated in a room. This could be a potential future feature.

# Notes

This app has the ability to use both plain browser-provided WebRTC (without the `simple-peer` or `webrtc-adapter`), as well as the newer simple-peer approach. By default, both `WebRTCSigServer.ts` and `WebRTC.ts` files are used and they're the `simple-peer` versions, which assume simple-peer is in use. 

However you'll also find a `WebRTCSigServer_Legacy.ts` and `WebRTC_Legacy.ts` files which are available in the code right beside their non-Legacy versions. The "legacy" files are the "pure WebRTC" ones (i.e. no simple-peer). If you ever want to remove `simple-peer` as a dependency, and stop using `simple-peer` then all you'd have to do is 1) rename the files so the Legacy filenames are the ones being used, and then 2) optionally, remove the yarn packages `simple-peer` and `webrtc-adapter`. In other words, if you want to actually switch back and forth between a `simple-peer` implementation and a non-`simple-peer` implementation all you need to do is rename those files appropriately.

*I'm probably being paranoid to maintain the ability to egress back from `simple-peer`, because it's well established and should be solid to use forever, but since it was easy to maintain this egress path simply by keeping the old Legacy code in place, that's what I'm doing for now. Feel free do delete the Legacy files if you're all-in on `simple-peer`!