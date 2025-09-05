# Quanta Docs Developer Guide

This document contains technical information about Quanta Docs (File System-based Wiki) written for the software developer audience. The Quanta app is a block-based document editor and cloud publishing app. You should read the [User Guide](./docs_user_guide.md) for a less technical overview of the app, describing the high-level features. Quanta (the App) is implemented as a plugin for the Quanta Platform. In this document when we say `Quanta` it's referring to the Quanta App itself, not the entire platform.

There are two ways this app can be deployed: 1) As a localhost app which edits file system files directly, an 2) As a Web App that runs in the cloud, using Docker, and uses a Virtual File System, to hold documents, which is implemented as Postgres Functions. These two types of file systems are called LFS and VFS recpectively. We sometimes refer to the 'localhost' deployment as `Desktop Mode` so keep in mind those two things are synonymous.

# LFS vs VFS File Systems

This app can be run locally, as a localhost web app, which accesses your file system directly and edits actual files, which is called an LFS setup (Local File System). However for a web server running online and hosting multiple users, you will need to use VFS configuration (Virtual File System), which relies on a Cloud-based virtual file system implemented entirely in Postgres and is only available in the Docker-Compose-based deployment

To control which files are accessible thru the app, we have a section in the `config-*.yaml` files named `public-folders` where the admin can define multiple file system roots. Each root can be either a LFS (for Linux File System) or VFS (Virtual File System) type. 

* `LFS` is only for single-user installations (i.e. running this app outside of docker, and on a person's computer like any other desktop software) 

* `VFS` provides a multi-user website experience, similar to a cloud-based Jupyter Notebooks. (Technical Note: VFS is a File System implementation made up entirely of a single PostgreSQL table, and a set of PostgreSQL functions which loosely emulates the `fs` NPM module's API entirely but self-contained in Postgres! We don't provide full-coverage of all of the `fs` API because we don't need it, but we support basic functionns necessary to drive this app, like reading directories, reading/writeing files, renaming, deleting, etc.)

## IFS Interface - Technical Note

Note to software developers only: The genius of our `LFS/VFS` design is that we have a common interface `IFS` which is an abstraction layer hiding from the application code the need to know or care which file system is in use! We just have a polymorphic base-interface `IFS` which all the application code uses, in a way that makes it fully independent from which file system is controlling any given File System `root`.   

# File/Folder Ordinals

The reason `Quanta` is able to use File Systems (i.e. files/folders) as the fundamental building blocks to hold Document Cell content in individual files (as in Jupyter-like Cells), is because Quanta uses the one ingredient what was always required to make this happen: Ordinals. The reason no one (afaik) has ever used a folder structure as the primary storage system for arbitrary documents, in this fine-grained way, is simple: Files/Folders don't have any inherent ordering. 

File Systems have always only been able to sort files alphabetically or by timestamps, but they have no inherent persistent ordering, in the way that paragraphs in a document are 'ordered'. Thus it has always been essentially impossible to make a "Cell-based" (as in Jupyter Cells) document system based on File Systems, until that problem is solved. The solution Quanta uses to solve this challenge is simply to automatically prefix files with an ordinal number like `0123_MyFile.md` or `0456_My_Folder`. We chose this approach rather than something like XATTRS in Linux so that our documents can be accessed, browsed, edited, completely outside of the Quanta system using any Markdown, or Text Editor, or File Explorer you have, because they all can sort by filename ordinals. This is a huge benefit because it means you're not locked into using Quanta forever, and there's always a way to view your content with a reasonable user experience on any system. It's only inside Quanta Application itself where you get a Jupyter-like exerience editing those same folder structures.

# Project Files

The server-side implementation of Quanta is in `/plugins/docs/server` and and the client-side is in `/plugins/docs/client`.

# Security and Authorization

Rather than password security, the entire Quanta Platform and all plugins use exclusively a cryptographic key pair that's automatically created by the browser. In this way all requests sent to the server are cryptographically signed for authenticity. The server has a `user_info` table which knows the public key for each user and so this is how we check signatures on the server side to authenticate requests. In the VFS table [vfs_nodes](/plugins/docs/server/VFS/SQL/schema.sql) which holds the entire file system we simply have a foreign `owner_id` key which points to the `user_info` table ID. This is how we enable each file/folder in the file system to be owned by a specific user. 

# File Sharing

Currently we only allow sharing of files/folders to be either private or public. Private files/folders can only be viewed by their owner, and public items can be viewed by anyone.

# Special Syntax

Quanta uses primarily standard Markdown for renering content, but there is one piece of non-standard syntax which is for how to display information in a columnar layout. The way this is done is by simply putting `***` (three asterisks) all on line line to split up the content into columns.

# Standalone Features

## Launcher Buttons

In `Desktop Mode` (running as a local browser app, and not as an online website) Quanta can run commands on the Operating System, using a special markdown syntax that will render as clickable buttons allowing a Desktop Launcher to be created, which can be used as in interface to have a single-click way to run applications, utilities, or shell scripts on your local machine.

Here's an example of the syntax:

```menu
- title: Notes
  cmd: code
  args: /home/clay/ferguson/notes.md
 
- title: Calculator
  link: file:///home/clay/ferguson/calc.html

- title: Pick
  bash: /home/clay/ferguson/A-PassApp/choose-pass-console.sh
```

As you can see in the above the way buttons are embedded into a page is by using Markdown `Fenced Code Block` syntax which contains YAML. The platform will automatically notice this is a `menu` type of code and render the buttons instead of the code. The first button (Notes) will show a button titled "Notes" which will run VSCode (code) with the argument. This means you can be in your web browser, and click this button and VSCode will open up on your machine. The "Calculator" button is similar but uses `link` to trigger your Operating System to open the link with the correct app based on it's filename extension. And lastly the `bash` command is demonstrated (the "Pick" button) showing how to run a shell script. 

TODO: proivde screenshot and more detail about the `command runner` capability.

