# Quanta Docs Developer Guide

This document contains technical information about Quanta Docs (File System-based Wiki) written for the software developer audience. The Quanta app is a block-based document editor and cloud publishing app. You should read the [User Guide](./user_guide.md) for a less technical overview of the app, describing the high-level features. Quanta (the App) is implemented as a plugin for the Quanta Platform. In this document when we say `Quanta` it's referring to the Quanta App itself, not the entire platform.

This app runs as a web application using Docker and uses a Virtual File System (VFS) to hold documents, which is implemented as Postgres Functions.

# Virtual File System (VFS)

The application uses a Virtual File System (VFS) that provides a multi-user website experience, similar to a cloud-based Jupyter Notebooks. VFS is a File System implementation made up entirely of a single PostgreSQL table, and a set of PostgreSQL functions which emulates the `fs` NPM module's API entirely but self-contained in Postgres! We don't provide full-coverage of all of the `fs` API because we don't need it, but we support basic functions necessary to drive this app, like reading directories, reading/writing files, renaming, deleting, etc.

To control which files are accessible through the app, we have a section in the `config-*.yaml` files named `public-folders` where the admin can define file system roots.

# File/Folder Ordinals

The reason `Quanta` is able to use File Systems (i.e. files/folders) as the fundamental building blocks to hold Document Cell content in individual files (as in Jupyter-like Cells), is because Quanta uses the one ingredient what was always required to make this happen: Ordinals. The reason no one (afaik) has ever used a folder structure as the primary storage system for arbitrary documents, in this fine-grained way, is simple: Files/Folders don't have any inherent ordering. 

File Systems have always only been able to sort files alphabetically or by timestamps, but they have no inherent persistent ordering, in the way that paragraphs in a document are 'ordered'. Thus it has always been essentially impossible to make a "Cell-based" (as in Jupyter Cells) document system based on File Systems, until that problem is solved. The solution Quanta uses to solve this challenge is simply to automatically prefix files with an ordinal number like `0123_MyFile.md` or `0456_My_Folder`. This approach provides a consistent, predictable ordering system that allows the Virtual File System to maintain proper document structure and cell ordering within the Quanta Application interface.

# Project Files

The server-side implementation of Quanta is in `/plugins/docs/server` and and the client-side is in `/plugins/docs/client`.

# Security and Authorization

Rather than password security, the entire Quanta Platform and all plugins use exclusively a cryptographic key pair that's automatically created by the browser. In this way all requests sent to the server are cryptographically signed for authenticity. The server has a `user_info` table which knows the public key for each user and so this is how we check signatures on the server side to authenticate requests. In the VFS table [vfs_nodes](/plugins/docs/server/SQL/schema.sql) which holds the entire file system we simply have a foreign `owner_id` key which points to the `user_info` table ID. This is how we enable each file/folder in the file system to be owned by a specific user. 

# File Sharing

Currently we only allow sharing of files/folders to be either private or public. Private files/folders can only be viewed by their owner, and public items can be viewed by anyone.

# Temporary Files (TMP Folder)

The application uses a `tmp` folder mounted at `/app/dist/server/tmp` inside the Docker container for storing temporary files such as exported ZIP archives. This folder is defined as a volume in `docker-compose.yaml` and maps to the host's `./tmp` directory.

**TODO**: There is currently no automatic cleanup of ZIP files in the TMP folder. These files accumulate over time and must be manually deleted. A scheduled cleanup mechanism should be implemented to remove old temporary files.

# Special Syntax

Quanta uses primarily standard Markdown for renering content, but there is one piece of non-standard syntax which is for how to display information in a columnar layout. The way this is done is by simply putting `***` (three asterisks) all on line line to split up the content into columns.



