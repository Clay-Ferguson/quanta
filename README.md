# Quanta Web Platform
Quanta is a Web Platform with a plugin architecture that allows different plugin-based apps (aka extensions) to be created rapidly, by reusing most of the core platform code. There is a lot of boiler plate involved with creating a new Web Project from scratch and also a lot of code that will be common across all web apps. 

Quanta provides a solution for being able to ship products fast by simply implementing one or more plugins that define the custom pages and capabilities of a specific app, to create a finished product without having to rewrite the common kinds of boilerplate you find in all web apps. *The name **Quanta** can refer to the platform itself, as well as the Filesystem based document editor, because this editor was the initial reason for creating the platform.

### Screencast of Documents Plugin:

![Quanta Platform Demo](./plugins/docs/docs/img/screencast.gif)

## Platform Developer Guides
* [Core Platform](./public/docs/platform/platform_developer_guide.md)
* [Extensions](./public/docs/extensions/extensions_developer_guide.md)

## Plugins Documentation Links (External Projects)

The two existing (known) plugins for Quanta are as follows:

* [Documents Plugin](https://github.com/Clay-Ferguson/quanta-docs-plugin)
* [Chat Plugin](https://github.com/Clay-Ferguson/quanta-chat-plugin)

#### Docs Plugin
* [User Guide](https://github.com/Clay-Ferguson/quanta-docs-plugin/blob/main/docs/user_guide.md)
* [Developer Guide](https://github.com/Clay-Ferguson/quanta-docs-plugin/blob/main/docs/developer_guide.md)

#### Chat Plugin
* [User Guide](https://github.com/Clay-Ferguson/quanta-chat-plugin/blob/main/docs/user_guide.md) 
* [Developer Guide](https://github.com/Clay-Ferguson/quanta-chat-plugin/blob/main/docs/developer_guide.md)

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
* For docker run: `/build/dev/docker/build-and-start.sh`

## Local Install (non-Development)
* Create installation folder: `/build/local/create-install.sh`
* Run local installation: `/build/local/run.sh`


## Testing
Quanta uses an embedded testing system that runs tests during application startup when configured to do so. For detailed information about the testing architecture, how to run tests, and how to write new tests, see the [Testing Guide](./TESTING.md).
