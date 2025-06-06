# About Quanta Chat

## [Try QuantaChat Now! --> https://chat.quanta.wiki](https://chat.quanta.wiki)

### Peer-to-Peer WebRTC-based Chat Web App

# Goals and Uses

The purpose of `Quanta Chat` is to be the simplest possible, yet full featured, chat app that can work for any small or medium sized group of people, while still using all modern web standards and technologies for a NodeJS-based app. The idea is that larger apps like Slack, for example, are much more complex than necessary, and not self-hosted. Quanta Chat is something simple enough for any developer to deploy and has code that's arguably as simple as possible.

This app also serves as a good pedagogical example of not only a modern Web App, but demonstrates the power of WebRTC, also, again hopefully in the simplest, and best organized, and easiest way to understant that's possible. The app allows users to select a pure-P2P mode where messages are never sent thru the master server, as well as a standard Server-Mode where messages are stored on the server, so that people don't need to be online simultaneously to communicate.

SQLite DB was chosen for this app primarily to keep it as small and simple as possible, and to be able to run on tiny servers with limited resources and memory. To make this into a highly-scalable commercial-grade app, the main change that would need to be done would be the fairly simple task of switching to a real DB (like PostgreSQL or MySQL), but doing so is so simple it could be done by an AI in probably a single-shot prompt.

# Features

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

# User Guide

Learn how to use the app with the [User Guide](public/user_guide.md)

## Tech Stack

* TypeScript
* ReactJS
* TailwindCSS + SCSS
* NodeJS Express Server 
* Vite Builder
* Yarn Package Manager
* Browser-based WebRTC
* Browser persistence thru JS IndexedDB
* Server-side DB is SQLite3

# How it Works (Technical)

## The Server

The command shown above starts the `Quanta Chat Server` which is a very tiny web server with just two simple purposes 1) To serve the single page of the app and 2) To run as a `Signaling Server` which allows the clients/peers/browses to find each other, which happens automatically.

## The Chat Client

The chat client itself is very simple. It allows users to enter their username and a chat room name, and then click "Join" button, to join that room. Rooms are automatically created once they're needed by someone. The room's history of chat message is kept only on the peers (clients) and is saved in browser local storage. None of the messages are ever seen by the server, because they're sent directly to the browsers of all chat room participants in a peer-to-peer way.

If you refresh the browser you'll need to click "Join" again to resume, but the chat room's history will still be there. Note, however that since this is a peer-to-peer system (with no central storage or database) any conversations that happen in a room while you're not online and in that room, will not be visible to you. There's currently no strategy for syncing messages across all users that have ever participated in a room. This could be a potential future feature.

## How to Build+Run

We use Yarn builder. See files `run-dev.sh` and `run-prod.sh` which are self explanatory.
