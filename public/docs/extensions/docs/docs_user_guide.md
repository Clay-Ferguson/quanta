# Quanta User Guide

**Quanta** is a powerful file system-based document editor that allows you to view, edit, and organize your documents and folders in a tree-like structure, similar to Jupyter Notebooks, but where each 'cell' is an actual file on the file system rather than a chunk of JSON in a monolithic document file like Jupyter uses. The app provides a comprehensive set of tools for managing your content, from simple text editing to advanced file operations, creating a Jupyter-like experience (block-based editor) but using your file system itself for storage.

## LFS vs VFS File Systems

Technical notes about File System setup: This app can be run locally, as a web app, which accesses your file system directly and edits actual files, which is called an LFS setup (Local File System). However for a web server running online and hosting multiple users, you will need to use VFS configuration (Virtual File System), which relies on a Cloud-based virtual file system implemented entirely in Postgres and is only available in the Docker-Compose-based deployment

To control which files are accessible thru the app, we have a section in the `config-*.yaml` files named `public-folders` where the admin can define multiple file system roots. Each root can be either a LFS (for Linux File System) or VFS (Virtual File System) type. 

* `LFS` is only for single-user installations (i.e. running this app outside of docker, and on a person's computer like any other desktop software) 

* `VFS` provides a multi-user website experience, similar to a cloud-based Jupyter Notebooks. (Technical Note: VFS is a File System implementation made up entirely of a single PostgreSQL table, and a set of PostgreSQL functions which loosely emulates the `fs` NPM module's API entirely but self-contained in Postgres! We don't provide full-coverage of all of the `fs` API because we don't need it, but we support basic functionns necessary to drive this app, like reading directories, reading/writeing files, renaming, deleting, etc.)

### IFS Interface - Technical Note

Note to software developers only: The genius of our `LFS/VFS` design is that we have a common interface `IFS` which is an abstraction layer hiding from the application code the need to know or care which file system is in use! We just have a polymorphic base-interface `IFS` which all the application code uses, in a way that makes it fully independent from which file system is controlling any given File System `root`.   

## File/Folder Ordinals

The reason `Quanta` is able to use File Systems (i.e. files/folders) as the fundamental building blocks to hold Document Cell content in individual files (as in Jupyter-like Cells), is because Quanta uses the one ingredient what was always required to make this happen: Ordinals. The reason no one (afaik) has ever used a folder structure as the primary storage system for arbitrary documents, in this fine-grained way, is simple: Files/Folders don't have any inherent ordering. 

File Systems have always only been able to sort files alphabetically or by timestamps, but they have no inherent persistent ordering, in the way that paragraphs in a document are 'ordered'. Thus it has always been essentially impossible to make a "Cell-based" (as in Jupyter Cells) document system based on File Systems, until that problem is solved. The solution Quanta uses to solve this challenge is simply to automatically prefix files with an ordinal number like `0123_MyFile.md` or `0456_My_Folder`. We chose this approach rather than something like XATTRS in Linux so that our documents can be accessed, browsed, edited, completely outside of the Quanta system using any Markdown, or Text Editor, or File Explorer you have, because they all can sort by filename ordinals. This is a huge benefit because it means you're not locked into using Quanta forever, and there's always a way to view your content with a reasonable user experience on any system. It's only inside Quanta Application itself where you get a Jupyter-like exerience editing those same folder structures.

## Standalone Features

In `Desktop Mode` (running as a local browser app, and not as a website) Quanta can run commands on the Operating System, and is only designed for local users running on their own machine, or perhaps an admin running on a server machine, but it not a multi-user web app. Security is done by crytographically signing requests by the browser which is expected to have a public key which matches the public key defined in 'adminPublicKey' of the config yaml.

TODO: proivde screenshot and more detail about the `command runner` capability.

## Getting Started

Using Quanta is much like browsing a File System, except that the content itself is being presented to you rather than just filenames. So Quanta is like a Wiki, or Document Editor/Publisher in that regard. Quanta presents your files and folders as a unified document view that you can browse around in. Each file in a folder is displayed as a separate section/cell, creating the appearance of one continuous document while maintaining individual file organization. At any given time you'll be viewing the content of a folder, but you'll be seeing all the markdown of all the files in that folder presented to you as a big editable document. So in the sense that you can edit online content this is similar to a Wiki.

### Navigation

#### Folder Navigation
- **Click on any folder** to navigate into it and view its contents
- **Use the Back button** in the header to return to the previous page
- **Parent folder navigation** - When viewing a subfolder, you can navigate up one level

#### File Structure

All files and folders use a 4-digit numeric prefix (e.g., "0001_", "0002_") that controls their display order. This numbering system ensures your content appears in a consistent, predictable sequence. When displayed to you, these numeric prefixes are hidden for a cleaner appearance.

## Viewing Modes

**Quanta** offers several viewing modes to suit different needs:

### Standard View Mode
In standard view, files are rendered as formatted Markdown content, providing a clean reading experience. Images are displayed inline with the text.

### Edit Mode
When **Edit Mode** is enabled via the checkbox in the header:
- Checkboxes appear next to each item for selection
- Edit controls become available for individual items
- Additional management buttons appear in the header
- Insert buttons appear between items for adding new content

### Meta Mode
When **Meta Mode** is enabled:
- File modification dates are displayed
- Additional file metadata is shown
- Technical details about each file become visible

### Names Mode
When **Names Mode** is enabled:
- Files are displayed as clickable file names instead of rendered content
- Useful for quickly scanning file structures
- Images appear as thumbnails rather than full-size
- Provides a more compact, file-browser-like view

### View Width Control
A dropdown in the header allows you to adjust the content width:
- **Narrow**: Compact view for focused reading
- **Medium**: Balanced view (default)
- **Wide**: Expanded view for maximum content visibility

## Creating Content

### Creating New Files
1. **Enable Edit Mode** using the checkbox in the header
2. **Click the plus (+) icon** that appears between existing items or at the top
3. A new file is automatically created with a default name
4. The file immediately opens in edit mode for you to add content
5. **Edit the filename** using the text field above the content area
6. **Add your content** in the text area below
7. **Click Save** to preserve your changes

### Creating New Folders
1. **Enable Edit Mode**
2. **Click the folder icon** that appears next to the plus (+) icon
3. Enter a name for your new folder
4. **Click Create** to add the folder
5. The folder will appear in the list and can be clicked to navigate into it

### File Upload Features
The extension supports multiple ways to add files:

#### File Upload
1. **Enable Edit Mode**
2. **Click the upload icon** (appears next to other insert options)
3. **Select one or more files** from your computer
4. Files are automatically uploaded and added to the current folder

#### Clipboard Upload
1. **Copy an image or file** to your clipboard (Ctrl+C or Cmd+C)
2. **Enable Edit Mode**
3. **Click the clipboard upload icon**
4. The clipboard content is automatically uploaded as a file

## Editing Content

### Editing Files
1. **Enable Edit Mode**
2. **Click the edit icon** next to any file
3. The file switches to edit mode showing:
   - **Filename field** (at the top) - modify the file name if desired
   - **Content area** (below) - edit the file's content
4. **Make your changes** to either the filename or content
5. **Choose your save option**:
   - **Save**: Saves changes to the current file
   - **Split**: Saves content and splits it into multiple files (see Content Splitting below)
   - **Cancel**: Discards all changes

### Editing Folder Names
1. **Enable Edit Mode**
2. **Click the edit icon** next to any folder
3. **Enter the new folder name** in the text field
4. **Click Rename** to apply changes or **Cancel** to discard

### Content Splitting
When editing a file, you can use the **Split** feature to divide content into multiple files:
1. **Add the delimiter `\n~\n`** (newline, tilde, newline) in your content where you want splits to occur
2. **Click the Split button** instead of Save
3. The system automatically creates separate files for each section
4. Files are numbered sequentially and positioned appropriately in the folder

## File and Folder Management

### Selecting Items
In Edit Mode, use the checkboxes to select one or multiple items:
- **Individual selection**: Click the checkbox next to any item
- **Select all/none**: Use the master checkbox that appears when items are available
- **Selection counter**: Shows how many items are currently selected

### Moving Items
Individual items can be reordered using the move controls:
1. **Enable Edit Mode**
2. **Use the up/down arrow icons** next to each item
3. Items swap positions with their neighbors
4. The numeric ordering is automatically maintained

### Cutting and Pasting
Quanta supports cut-and-paste operations for moving items:

#### Cutting Items
1. **Select one or more items** using checkboxes
2. **Click the Cut button** in the header
3. Selected items are marked for moving (they remain visible but are marked as cut)

#### Pasting Items
After cutting items, you have several paste options:
- **Paste at top**: Use the paste button that appears at the top of the folder
- **Paste after specific item**: Use the paste button that appears below any item
- **Paste into folder**: Click the paste icon next to any folder to move items into that folder
- **Undo Cut**: Click the "Undo Cut" button to cancel the cut operation

### Deleting Items
1. **Select items** using checkboxes in Edit Mode
2. **Click the Delete button** in the header, or
3. **Use the delete icon** next to individual items
4. **Confirm deletion** in the dialog that appears
5. **Note**: Deletion is permanent and cannot be undone

### Joining Files
Multiple text files can be combined into one:
1. **Select multiple text files** (minimum 2) using checkboxes
2. **Click the Join button** in the header
3. Files are combined in ordinal order into the first selected file
4. All other selected files are automatically deleted after joining

## Search Functionality

### Accessing Search
1. **Click the search icon** in the header to open the Search page
2. The search operates within the current folder and its subfolders

### Search Options
The search feature offers three modes:
- **Match Any**: Finds content containing any of the entered words
- **Match All**: Finds content containing all of the entered words
- **REGEX**: Allows advanced pattern matching using regular expressions

### Using Search Results
1. **Enter your search query** in the text field
2. **Select your preferred search mode**
3. **Click Search** or press Enter
4. **Click on any search result** to:
   - Navigate directly to the folder containing that file
   - Automatically scroll to the specific file in the document view

## Advanced Features

### File System Integration
For administrators with desktop access:
- **File system editor**: Opens your system's default file editor
- **Explore folder**: Opens the current folder in your file manager (desktop mode only)

### Static Site Generation
The **Generate Static Site** button (cube icon) creates a static HTML version of your document structure, useful for publishing or sharing.

### Refresh and Sync
- **Refresh button** (sync icon): Manually refresh the current folder view
- The interface automatically updates when changes are made

### Keyboard Shortcuts
- **Enter key**: Execute search when in the search field
- **ESC key**: Cancel edit operations
- **Tab key**: Navigate between form fields during editing

## Tips and Best Practices

### Organization
- Use descriptive folder and file names
- Leverage the automatic numbering system to control content order
- Consider using the Meta Mode to review file modification dates

### Content Management
- Use the Split feature to break large documents into manageable sections
- Take advantage of the Join feature to consolidate related content
- Use Cut and Paste for efficient reorganization

### Workflow Efficiency
- Enable Names Mode for quick file structure overview
- Use search functionality to quickly locate specific content
- Take advantage of upload features for adding external content

### File Naming
- While numeric prefixes are used internally, focus on meaningful names for the content portion
- File extensions are automatically added (.md for text files) if not specified
- Avoid special characters that might cause issues with file systems

