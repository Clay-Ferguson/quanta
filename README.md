# Quanta Web Platform

Quanta is a web platform which currently has two separate apps:

**Quanta:** A File Manager and Markdown Editor with an interface similar to Jupyter Notebooks, which converts a folder structure into a browsable and editable documents. [Quanta - User Guide](./public/docs/extensions/docs/docs_user_guide.md)

**Callisto:** A WebRTC-based messaging/chat app which can run in pure Peer-to-Peer mode or optinally use server-based storage to persist room messages. [Callisto - User Guide](./public/docs/extensions/chat/chat_user_guide.md) 

This project packages together [the above] two applications (two separate plugins) which are usable either separately or together depending on how you want to configure the app. 

# Quanta Web Platform

Quanta is a React-based Web Platform with a plugin interface that allows different extensions (i.e. applications) to be created rapidly, by reusing most of the core platform code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. Quanta provides a solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.*

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

Linux shell scripts named like `/build/dev/build-and-start.sh` are how we build/run outside of Docker. The `/build/dev/docker-run.sh` scripts are how we run via docker. This platform assumes it's running in a Linux environment, and has only been tested on Ubuntu.