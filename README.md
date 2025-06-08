# Quanta Web Platform

Quanta is a React-based Web Platform with a plugin interface that allows different extensions or applications to be created rapidly, by reusing most of the core framework code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. Quanta provides one solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without ever having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.*

Currently there are two available plugins/extensions:

1) Quanta: A File System-based document editor, with an interface similar to Jupyter Notebooks, which converts a folder structure into a browsable and editable documents.
2) Callisto: A WebRTC-based chat app which can run in pure Peer-to-Peer mode or optinally use server-based storage to persist room messages.

## [Try Callisto Now! --> https://chat.quanta.wiki](https://chat.quanta.wiki)

# User Guides

* [Callisto User Guide](./public/docs/chat_extension/chat_user_guide.md)
* [Quanta User Guide](./public/docs/docs_extension/docs_user_guide.md)

## Core Platform Tech Stack

Quanta is designed to work well on both desktop browsers as well as mobile devices and uses the following technologies.

* TypeScript
* ReactJS
* TailwindCSS + SCSS
* NodeJS Express Server 
* Vite Builder
* Yarn Package Manager
* Browser persistence thru JS IndexedDB
* Server-side DB is SQLite3

## How to Build+Run

We use Yarn builder. See files `run-dev.sh` and `run-prod.sh` which are self explanatory.
