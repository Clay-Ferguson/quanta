# Quanta Web Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![React](https://img.shields.io/badge/React-18.x-61DAFB?logo=react&logoColor=white)](package.json)
[![Vite](https://img.shields.io/badge/Vite-Build-646CFF?logo=vite&logoColor=white)](vite.config.ts)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-Styling-06B6D4?logo=tailwindcss&logoColor=white)](tailwind.config.js)
[![Node.js](https://img.shields.io/badge/Node.js-Server-339933?logo=nodedotjs&logoColor=white)](server/AppServer.ts)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](server/db/schema.sql)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](docker-compose.yaml)
[![Plugin Architecture](https://img.shields.io/badge/Architecture-Plugin--Based-8A2BE2)](public/docs/platform/platform_developer_guide.md)

Quanta is a Web Platform with a plugin architecture that allows different plugin-based apps (aka extensions) to be created rapidly, by reusing most of the core platform code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. 

Quanta provides a solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.

### Screencast of Documents Plugin:

![Quanta Platform Demo](./plugins/docs/docs/img/screencast.gif?raw=true)

## Platform Developer Guides
* [Core Platform](./public/docs/platform/platform_developer_guide.md)
* [Extensions](./public/docs/extensions/extensions_developer_guide.md)

#### Docs Plugin
* [User Guide](./plugins/docs/docs/user_guide.md)
* [Developer Guide](./plugins/docs/docs/developer_guide.md)

#### Chat Plugin
* [User Guide](./plugins/chat/docs/user_guide.md) 
* [Developer Guide](./plugins/chat/docs/developer_guide.md)

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
This platform assumes it's running in a Linux environment, and has only been tested on Ubuntu.

## Development
* For non-docker run: `/build/dev/build-and-start.sh`
* For docker run: `/build/dev/build-and-start.sh`

## Local Install (non-Development)
* Create installation folder: `/build/local/create-install.sh`
* Run local installation: `/build/local/run.sh`

## Testing
Quanta uses an embedded testing system that runs tests during application startup when configured to do so. For detailed information about the testing architecture, how to run tests, and how to write new tests, see the [Testing Guide](./TESTING.md).
