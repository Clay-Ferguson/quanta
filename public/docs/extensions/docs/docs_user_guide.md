# Quanta FS User Guide

The **Quanta FS** Extension is a powerful file system-based document editor that allows you to view, edit, and organize your documents and folders in a tree-like structure, similar to Jupyter Notebooks, but where each 'cell' is an actual file on the file system rather than in a monolithic document file. This extension provides a comprehensive set of tools for managing your content, from simple text editing to advanced file operations, creating a Jupyter-like experience (block-based editor) but using your file system itself for storage.

## LFS vs VFS File Systems

To control which files are accessible thru the app, we have a section in the `config-*.yaml` files named `public-folders` where the admin can define multiple file system `root`. Each root can be either a LFS (for Linux File System) or VFS (Virtual File System) type. 

* `LFS` is only for single-user installations (i.e. running this app outside of docker, and on a person's computer like any other desktop software) 

* `VFS` is still in an experimental (alpha) stage of development, and it will provide a multi-user website experience, similar to a cloud-based Jupyter Notebooks-like experience. (Technical Note: VFS is a File System implementation made up entirely of a single PostgreSQL table, and a set of PostgreSQL functions which emulate the `fs` NPM module's API entirely self-contained in Postgres! We don't provide full-coverage of all of the `fs` API because we don't need it, but we support basic functionns necessary to drive this app, like reading directories, reading/writeing files, renaming, deleting, etc.)

## IFS Interface - Technical Note

Note to software developers only: The genius of our `LFS/VFS` design is that we have a common interface `IFS` which is an abstraction layer hiding from the application code the need to know or care which file system is in use! We just have a polymorphic base-interface `IFS` which all the application code uses, in a way that makes it fully independent from which file system is controlling any given File System `root`.   

## File/Folder Ordinals

The reason `Quanta FS` is able to use File Systems (i.e. files/folders) as the fundamental building blocks to hold Document Cell content in individual files (as in Jupyter-like Cells), is because Quanta handles the one ingredient what was always required to make this happen: Ordinals. The reason (I believe) no one has ever, used a folder structure as the primary storage system for arbitrary documents is simple: Folders don't have any inherent ordering. File Systems have always only been able to sort files alphabetically or by timestamps, but they have no inherent persistent ordering, in the way that paragraphs in a document are 'ordered'. Thus it has always been essentially impossible to make a "Cell-based" (as in Jupyter Cells) document system based on File Systems, until that problem is solved. The solution Quanta uses to solve this challenge is simply to automatically prefix files with an ordinal number like `0123_MyFile.md` or `0456_My_Folder`. We chose this approach rather than something like XATTRS in Linux so that our documents can be accessed, browsed, edited, completely outside of the Quanta system using any Markdown, or Text Editor, or File Explorer you have, because they all can sort by filename ordinals. This is a huge benefit because it means you're not locked into using Quanta forever, and there's always a way to view your content with a reasonable user experience on any system. It's only inside Quanta Application itself where you get a Jupyter-like exerience editing those same folder structures.

## Standalone Features

In `Desktop Mode` (running as a local browser app, and not as a website) Quanta Extension can run commands on the Operating System, and is only designed for local users running on their own machine, or perhaps an admin running on a server machine, but it not a multi-user web app. Security is done by crytographically signing requests by the browser which is expected to have a public key which matches the public key defined in 'adminPublicKey' of the config yaml.

## Getting Started

Quanta presents your files and folders as a unified document view. Each file in a folder is displayed as a separate section/cell, creating the appearance of one continuous document while maintaining individual file organization.

## System Requirements

This extension assumes the server will be running in a Linux environment, and has only been tested on Ubuntu. The search function uses 'grep' on the OS level, and also for searching binary files (namely PDFs) it requires the `pdfgrep` utility to have been installed on the machine.

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

## Troubleshooting

### Common Issues
- **Can't see edit controls**: Ensure Edit Mode is enabled via the header checkbox
- **Files appear out of order**: The system maintains automatic ordering via numeric prefixes
- **Upload not working**: Ensure you have proper permissions and the file types are supported
- **Search not finding content**: Try different search modes or check that you're in the correct folder

### Error Recovery
- **Accidental deletions**: There is no undo for deletions - use caution
- **Lost changes**: Always save your work before navigating away
- **Cut operations**: Use "Undo Cut" if you change your mind about moving items

Quanta provides a powerful yet intuitive way to manage your content, combining the flexibility of a file system with the convenience of a unified document interface.