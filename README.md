# Quanta Project

This project packages together two applications which are usable either separately or together depending on how you want to configure the app. These two apps are: 

1) Quanta: A File Manager and Markdown Editor 
2) Callisto: A WebRTC-based messaging/chat app 

The reason we have two applications is that Quanta itself is a core platform which requires one or more plugins/extensions to be activated, to enable specific apps. We package all availiable 'extensions' (or apps) into this same 'monorepo' (Single Git Repository), so you get them all at once, all in the same project, but you can enable or disable them independently. 

Since plugins are kept in completely separate folder structures for both the server and the client, you can also completely remove whichever plugins you never intend to use simply by deleting folders.

# Quanta Web Platform

Quanta is a React-based Web Platform with a plugin interface that allows different extensions or applications to be created rapidly, by reusing most of the core framework code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. Quanta provides one solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without ever having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.*

Currently there are two available plugins/extensions:

1) Quanta: A File System-based document editor, with an interface similar to Jupyter Notebooks, which converts a folder structure into a browsable and editable documents.
2) Callisto: A WebRTC-based chat app which can run in pure Peer-to-Peer mode or optinally use server-based storage to persist room messages.

# User Guides

* [Callisto Plugin - User Guide](./public/docs/extensions/chat/chat_user_guide.md)
* [Quanta Plugin - User Guide](./public/docs/extensions/docs/docs_user_guide.md)

# Developer Guides

* [Platform - Developer Guide](./public/docs/platform_guide/platform_guide.md)
* [Extensions - Developer Guide](./public/docs/extensions_guide/extensions_guide.md)
* [Quanta Plugin - Developer Guide](./public/docs/extensions/docs/docs_developer_guide.md)


## Core Platform Tech Stack

Quanta is designed to work well on both desktop browsers as well as mobile devices and uses the following technologies.

### Front End

* TypeScript
* ReactJS
* TailwindCSS + SCSS
* Vite Builder
* Yarn Package Manager
* Browser persistence thru JS IndexedDB

### Back End

* NodeJS Express Server 
* Server-side DB PostgreSQL
* Deployed via Docker Compose

## How to Build+Run

Linux shell scripts named like `run-*.sh` are how we build/run outside of Docker. The `docker-run-*.sh` scripts are how we run docker. *Note: The only reason to ever run outside of Docker is to run the Quanta plugin to edit files on your local file system and to utilize the menu capabilities of the Quanta plugin.*

## System Requirements

This platform assumes it's running in a Linux environment, and has only been tested on Ubuntu. If you're a Windows users you'd need to be running only a Docker configuration, since that has the Linux runtime environment built-in.