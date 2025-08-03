# Quanta Web Platform
Quanta is a File Manager and Markdown Editor (similar to Jupyter Notebooks and Obsidian), which can run either locally, where it directly uses local files, or as a cloud-based multi-user app where a `Virtual File System` is used. When deployed to the cloud you also get a 'chat room' feature where users can do realtime messaging. The Document-centric features and the Chat-related features are implemented in two separate plugins which can actually be used either together or independently.

Quanta is a React-based Web Platform with a plugin interface that allows different extensions (i.e. applications) to be created rapidly, by reusing most of the core platform code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. Quanta provides a solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.


## User Guides
* [Quanta Docs](./public/docs/extensions/docs/docs_user_guide.md)
* [Quanta Chat](./public/docs/extensions/chat/chat_user_guide.md) 

## Developer Guides
* [Core Platform](./public/docs/platform/platform_developer_guide.md)
* [Extensions](./public/docs/extensions/extensions_developer_guide.md)
* [Quanta Docs Plugin](./public/docs/extensions/docs/docs_developer_guide.md)
* [Quanta Chat Plugin](./public/docs/extensions/chat/chat_developer_guide.md)


## Core Platform Tech Stack
Quanta is designed to work well on both desktop browsers as well as mobile devices and uses the following technologies.

### Front End
* TypeScript
* ReactJS
* TailwindCSS + SCSS
* Vite Builder
* Yarn Package Manager
* Browser persistence thru JS IndexedDB
* Jest+Supertest Testing

### Back End
* NodeJS Express Server 
* Server-side DB PostgreSQL
* Deployed via Docker Compose

## How to Build+Run
Linux shell scripts named like `/build/dev/build-and-start.sh` are how we build/run outside of Docker. The `/build/dev/docker-run.sh` script is how we run via docker. This platform assumes it's running in a Linux environment, and has only been tested on Ubuntu.

## Unit Testing 
See [TESTING.md](/build/TESTING.md)