# Notes to Copilot AI Agent about the `Tree Viewer` Feature

This document contains notes to explain to our Coding Agent (Github Copilot running inside this VSCode), how to implement the new `Tree Viewer` Feature. We will let the agent complete this feature one step at a time, as shown below, in the steps after the overview.

* Note 1: If you need to do any test builds at all use `yarn build` for that. Don't attemp to run the app however. I will do all the testing myself.

* Note 2: After you're done working on something, if the only thing left is to fix indentation, and there are no other errors that you know of other than indentation, then please just declare you're done, and stop working. You can mention you left indentation incomplete if you want. It's easier for me to take care of indentation than for you, the AI, to do it.

* Note 3: Current Status of this feature: The LLM is about to do "Step #21"

## Overview

This feature will let the user view a server-side folder as an array of Markdown elements on the `TreeViewerPage` of this app. For example if there are 10 files in the server-side folder, we will have 10 separate `Markdown` components on the tree viewer page, displayed vertically one after the other. The goal is to present a folder to the user, as if it was one big file. If we encounter any images in our directory listing then the image will be represented as an <IMG> tag of course, with the url to that file.

The `GlobalState` variable named `treeFolder` controls which folder is currently being viewed. We will have a server endpoint named `/api/docs/render/${treeFolder}`, as it's URL path, exposed as a `get` HTTP method which accepts, the name of the folder to be rendered, relative to the `QUANTA_TREE_ROOT` (which is an environment variable on the server). So the absolute path of the folder to be rendered would be a string `${QUANTA_TREE_ROOT}${treeFolder}`, which is just the concatenation of course.

## Architecture Notes

The `GlobalState.tsx` file is where our react global state is defined, and defaults and initial values for it are set. This is the state that's seen across the entire app of course, and can be updated to make the reactive app refresh itself.

## Steps

### Step 1: (completed)

For this first step, here are the instructions to the AI Agent for what to do:

* Create the 'get' method in 'ChatServer.ts' that calls a Controller method (that you'll create) named 'treeRender'.
* The 'treeRender' should return an array of objects representing each 'file' that was found in the 'treeFolder'
* The array should be properly typed with each element in the array being a 'TreeNode' type.
* The TreeNode type (that you will define), will have, 'createTime (number), modifyTime (number), content (string), mimeType (string)'.
* When the TreeNode array is generated we assume every file is either text or an image, and we detect images as file extensions 'png, jpeg, jpg'
* The TreeNode items will also be sorted alphabetically by filename.
* Additional Criteria for files: We only consider files that are named like "NNNNN_" where N is a digit. We allow any number of digits followed by the underscore, using this JavaScript `if (!/^\d+_/.test(file)) {...`. This is because the file browser we're creating expects all the files/folders to be numbered, for persistent positional ordering.

Summary: So we're just creating a way to let the browser/client request a directory listing and we're sending back the array that represents the files and folders. Be sure to put the implementation itself in the 'Controller.ts' file, not in the 'ChatServer.ts' file. By the way, please don't try to run the app yourself, to test this stuff. Just write the code and I'll run and test it.

STATUS UPDATE: Step 1 has been completed. `TreeRender_Response` is the type of what this endpoint responds with.

### Step 2: (completed)

In this step you will add basic rendering in `TreeViewerPage` component, by calling the endpoint to get the array of file content first, inside the partially implemented `fetchTree` method. In the place we currently have a `Markdown` react component in there just to prove the page works, we need to adjust that to instead iterate over the `TreeNode` array and display each one in a separate `Markdown` component, for all mimeTypes that are not images. For mime types which are images, we should display them in an HTML IMG tag instead of a `Markdown` component. Take your best guess at getting the URL correct for the image URLs, but as long as it's close I can fix it. I mean, the relative path aspect of the images might be tricky so just take your first guess at it, because it will be easy for me to fix that later. I will also probably adjust my endpoint to have a specific URL just for these document images, and that step hasn't been done yet. It will probably be in Step 3. So now that I think of it, just a placeholder URL that doesn't even work yet will be fine.

Notes: When rendering file or folder names, we will remove the numbering prefix, for display purposes and display the file/folder without the number. This will be accomplished simply by removing everything before the first underscore, including removeing the undescore too, in the file/folder names.

### Step 3: (completed)

In this step you will make the folders in the `TreeViewerPage` be clickable to drill down into any folder to view that folder.

### Step 4: (completed)

You'll add the "Parent" button to the page, to navigate back up the folder tree. On the `TreeViewerPage` will now add a button to the left of the back button that has a folder icon, and says "Parent" for the button text. This will alter the `treeFolder` global state variable (using the `gd` function) to make the tree viewer jump up to the parent folder of the current folder. So this is just a matter or removing the ending path part from `treeFolder` of course. You can hide this button if the `treeFolder` reaches a value of an empty strin or just a backslash.

### Step 5: (completed)

You'll add a new global state var named `editMode` which is a boolean, and defaults to `false`. This is for putting the TreeViewerPage into an "edit mode" which will mean that users can alter the files and folders. All the editing of files and folders will be in a future step, so don't implement an of that in 'Step 5' (this step). What we do want to do, however, is add a radio button, to the left of the "Parent" button, that's labeled "Edit", and of course will turn the boolean on and off. So all we need for now is this checkbox to be functional. It will need to of course use the `gd` function, as we've already seen, in prior steps, to update this boolean value in global state.

### Step 6: (completed)

When 'editMode' is on (true), we need to display a little row of buttons to the right of the "Modified:" (date) for files, but right justified, within our document display area (i.e. not all the way to the right of the page, but inside our document area). This row of buttons will have 4 buttons for now and will actually show up as clickable fontawesome icons. I'm calling them buttons, but they're just icons, with no border. The 4 buttons/icons will be for "edit", "delete", "move up", and "move down". You can figure out what fontawesome icons work best for each of those four. We won't be implementing the body of these functions in this step (step 6) but you should at least go ahead and add a fuction to the onClick of each one. The onClick functions should be implemented near the top of the component itself instead of being inline functions. So the goal is that both files and folders will have the same set of editing buttons displayed down the right side of the document, so the user can edit, delete, and move both files and folders.

### Step 7: (completed)

Next we need to implement the "Edit" functionality, for files (not folders). When the user clicks an "Edit" button (as created in Step 6), we want to switch from displaying the Markdown component to displaying an HTML textarea component right there in the page. We don't want a separate popup-editor. We're going to edit right inline, in page. For now we won't worry about trying to side the editor too dynamically (that will be a later step we'll do), so we can for now just make the editor be 10 rows of text high, and the width can be the full width of our document display area. You'll also need to create "Save" and "Cancel" buttons below the textarea.

Here's how to handle the state during editing: Let's create a new `GlobalState` variable called `editingNode` and it will contain the actual `TreeNode` object for the given file being edited, because we'll probably need that, but for now just set it. What we'll actually use to populate the textarea itself will be another new `GlobalState` variable called `editingContent`. So when the user firs clicks the "Edit" button, we will set `editingContent` to be the content value from the `TreeNode`. If the user clicks "Cancel" we will just reset both of these new Global State variables back to null (their default), and the page will of course re-render like no editing ever happened. However if the user clicks "Save" we will overwrite the `TreeNode` content value with the `editingContent` value, and then set both new state variables to null, which will cause the browser to now be displaying the edited content of course.

That will complete this step. Don't try to implement the server call to actually update the file. That will be the next step we'll do, but all we want for this current step (Step 7) is to update the in memory value for the content, as described.

### Step 8: (completed)

Building on Step 7, we can now implement the code to save the edited file content to the server. Based on all of the above you probably can do this without my guidance, but I'll give some info about my preferences to how to implement:

* Server side endpoint will be an HTTP POST call to endpoint `/api/docs/save-file/`. We'll be posting up an object with containing two properties: 1) filename, and 2) content. We're of course assuming this is a text file we're saving, so none of this needs to be binary content but just string content. You'll simply write the content to the file. Again do the actual logic in `Controller.ts` by creating a new controller method named `saveFile` and calling that controller function from the `ChatServer.ts` file.

* On the client, to call this server save method, create another new method in our component called `saveToServer` which does the call to the server to post up the new file content, and then call that from our existing save handler, but put it into a timer to delay the call to the server for half a second, so that nothign blocks the GUI from updating instantly. This delay is probably not needed becasue our state updater probably already takes care of it, but let's use a delay timer for the server call regardless.

### Step 9: (completed)

Now that we've already done the "Edit" capability for files, we can do a similar thing for folders, which will be just a folder 'rename' operation. In Step 7, above we had added `editingNode` which we can reuse for when we're "editing" a folder (i.e. renaming it), but let's create a new Global State variable called `newFolderName` to use almost identically to how we used `editingContent`. So let's go ahead and implement basically what we already did in Step 7 and Step 8 above, but for folder names. We already have the 'edit' icon on folders, so when the user clicks that we'll put an HTML text field right where the folder name was on the `TreeViewerPage` to again do a kind of inline edit of the folder name. So when the user starts editing we'll put into the `newFolderName` the value of the folder name with the numeric prefix (like: "0234_My-Folder-Name") removed. Then when we do the save to the server we'll send the full folder name with the correct numeric prefix added. 

This renaming is a bit tricky, unless you see what we're doing, so let me clarify a bit more: We use the `formatFileName` function in `TreeViewerPage` to strip off the numeric prefix before presenting the folder name to the user, and this clean version of the folder name is also what we want them to see during editing. So just before they do a save we can look in the `editingNode` to get the original prefix from the file name, and then prefix that to what the user enters for their new folder name. So in other words they're editing everything but the prefix, which stays the same always.

Let's use a server HTTP POST endpoint again, just like 'save-file' but let's call this one `/api/docs/rename-folder/`. Of course it will consist of a posted object which contains the `oldFolderName` and `newFolderName`, so we can do the rename of old to new. Once again, put the actual implementation on the `Controller.ts`. On the GUI, let's call the buttons "Rename" and "Cancel", and you will know how to implement them both based on the prior steps we've already done.

### Step 10: (completed)

In Step 7 above we added the ability to edit a file, and then in Step 9, we added the ability edit a folder. What you can do next in Step 10 (this step) is to update our "Edit File" capability so that it does everything it's doing now, but with a tiny new addition. Let's display an edit field for the "File Name" directly above the textarea that we currently use to edit content. This means users will be shown both text inputs at the same time, and they can enter both values to change the filename and/or change the file content. 

So on the client we need one new Global State variable named `newFileName` (just like we had done `newFolderName` for holding a new folder name). So the `newFileName` will of course default to the current file name (again with numbering prefix removed, just like we did for the folder renaming).

Then on the server side we'll be including the `newFileName` in the object we post to the `save-file` endpoint. So of course you need to add a new request variable named `newFileName` into the existing `saveFile` method in `Controller.ts`. Then the save file will first compare to see if `newFileName` is different from `filename`, indicating the file was renamed, and if so execute the rename operation on the existing file first. Then after the rename has been done, the `saveFile` will just continue to run of course to write the content into the file as well. So our `safe-file` endpoint will also be our way of renaming files.

Final point: Make the filename edit field full width just like the other inputs already are.

### Step 11: (completed)

Based on all the prior steps in this file, I think I could probably say "Now implement deleting", and you'd understand how, but I'll be more specific instead: In this step (Step 11) let's make the "Delete" icon work for both files and folders. You should create a server endpoint named `/api/docs/delete` and then make that endpoint call an implementation method named `deleteFileOrFolder` (that you will create) in the `Controller.ts` file. Obviously you're just going to pass the file or folder name in the HTTP POST and the server will do the delete.

The client side will first call the server endpoint to delete the file or folder, and then only after the server returns, we will remove the `TreeNode` (that was just deleted) from the `treeNodes` variable in `TreeViewerPage` component, making the page rerender with the current content after the delete. 

### Step 12: (completed)

Next let's implement the "Move Up", and "Move Down". We already have the up arrow and down arrow icons on both files and folders which already should have methods hooked into their onClick. So now you should implement these buttons, which work on both files and folders. It's very important to understand what "move up" and "move down" mean of course. Our file system uses a technique where every file and folder has a numeric prefix of the format "NNNN_MyFileName.md" for example, where the 'N' can be any digit 0 thru 9. So we have a prefix with leading zeroes which represents the ordinal position of the file or folder. This is how we can display files and folders in our document view simply by sorting by file name. We have other tools that take care of numbering the files from scratch, and so it really doesn't matter if the numbering in any file or folder starts with "1" or "0". All that matters is the sort order. So numeric values might be skipped over and that's fine. We might have "0001_FirstFile.md", followed by "0005_AnotherFile", without having any 0002, 0003, etc in between.

Anyway that was all just context to let you understand our ordinal system. So to "Move Up" a file or folder you do that by appropriately renaming two files. Similarly to "Move Down" you will do that by a couple of renames. If a file/folder is already at the lowest numbered of any other file/folder you cannot move it up of course. Likewise if a file/folder already has the highest number you cannot move it down. So "Move Up" is sort of an "ordinal swap" between the file and the one with the next lowest ordinal, and a "Move Down" is a swap of ordinal with whatever has the next largest ordinal.

So on the server you can create aother HTTP POST method at endpoint `/api/docs/move-up-down` which accepts an object with two values: 1) direction ("up" or "down"), and 2) filename of thing to move. The filename might be either a folder or a file of course. This endpoint will call a new Controller method you'll need to write named `moveUpOrDown`, which will do this. I'll let you figure out the best algo to use to efficiently find which files/folders to rename, and do the, rename.

Then so the client won't have to do any real work, you can send back to the client just the info needed to know what to renames were done as `oldName1`, `newName1`, `oldName2`,`newName2`, because there will be two things that were renamed, and all the client needs to know is what the 'renames' were. Then the client can just call a sort method to sort the local tree nodes to get them into the right alphabetical position based on the ordinals. Be careful not to sort on any full path. We need to sort just on the filenames/foldernames of course.

### Step 13: (completed)

Whenever edit mode is on, make the `TreeViewerPage` show two side by side icons below each `TreeNode` on the page. These two icons will be one that looks like a plus symbol icon (faPlus?) and one that looks like a folder icon (faFolder?). Make these icons the same size as the edit-related icons we have on the `TreeNode` renderings already. You can also center them horizontally in the document area. The faPlus icon should call a new function you'll create called `insertFile`, and the faFolder icon will call a new function called `insertFolder`. Both of these new functions will accept the `TreeNode` file/folder name (of the  `TreeNode` it's below) as an argument. We're going to eventually implement these to create files and folders but for this step (Step 13) all you should do is make these methods print the file/folder name.

### Step 14: (completed)

In the `insertFile` and `insertFolder` function we created in the last step we prompt the user for the new file/folder name, so in each one of those files add an HTTP POST call to a new endpoint you'll create named `/api/docs/file/create` and `/api/docs/folder/create` respectivey. You'll post the new `fileName` or `folderName` to this endpoint. Note that passing an empty string is valid, and for the case of 'inserting at top' we will indeed pass empty strings to indicate to create at top. Then make those endpoints call two methods in the `Controller.ts` named `createFile` and `createFolder`. For now don't try to implement anything in these two methods, just make them 'console.log' the name of the file, and if it's one of the top of page icons that was clicked it will end up printing "Create new top file" or "Create new top Folder".

### Step 15: (completed)

Let's implement just the `createFile` in `Controller.ts`. We will not try to implement `createFolder` yet, because we will do this a little at a time. If you consider how we've already done all the previous steps, which explained to you how our ordinals work as prefixes in our files and folders, I think you will know how to create the new file. The fileName we're passing to the controller will not yet have any number prefix on it, but it will be the ordinal that's one above the `insertAfterNode` ordinal. So to keep all our ordinals unique we'll need to renumber all the files/folders at or below the ordinal we're inserting at. You can probably create a function called `shiftOrdinalsDown` which queries a listing of all files/folders at the level where we're inserting the file and shifts them all down (incrementing the ordinal prefix by one), that way when we get around to implementing `createFolder` we can make use of the `shiftOrdinalsDown` in that method also.

### Step 16: (completed)

Your implementation of `createFile` works perfectly. So you can now implement `createFolder` in almost the exact same way, making use of `shiftOrdinalsDown` as we had planned.

### Step 17: (completed)

Next we're going to make all the files/folders on our `TreeViewerPage` have a checkbox associated with them, for multi-selecting. These checkboxes will only show up when Edit Mode is on, of course. Each checkbox will be to the left of the `TreeNode`'s display. Use a larger than normal checkbox too for better accessibility. Create a `GlobalState` variable named `selectedTreeItems` which is a `Set<TreeNode>` type, which holds the selections. Make make it so that it clears the selections whenever we open a new folder, or use the "Parent" button. As you know, our folders are clickable so users can drill down into them, by clicking, so that's the place I'm talking about. When users drill down into folders, we need to reset (remove) the selections. For now these selected items aren't used for anything, we just want to make sure we have the checkboxes and their state working.

### Step 18: (completed)

In `TreeViewerPage`, when edit mode is on, display 'Cut', 'Copy', 'Paste', 'Delete', buttons in header bar. So this is 4 new buttons. Put them just to the right of the "Edit" checkbox. Add the onClick methods for these new buttons called `onCut`, `onCopy`, etc. and don't try to implement them yet, just make them do a `console.log` so I can test that they're working, and that they only appear when edit mode is on.

### Step 19: (completed)

Next you should implement the "Delete" button we did in Step 18, to make the button fully functional on client and server. This button will delete whatever is in `selectedTreeItems` by sending the list of those full filenames to the server in an HTTP POST to a new endpoint you'll create named `/api/docs/delete`. Like our other 'post' methods in the server we will make it simply call the `Controller.ts` where we will do the implementation. So you'll create a controller method named `deleteItems`, which simply deletes all the files/folders it was sent.

Now, it will be obvious how to complete this on the client, to get the client up to date, by simply removing all the `TreeNodes` from the `treeNodes` array, and clearing out `selectedTreeItems` by using `gd` (global dispatch) to update the global state.

After all that is done, display a message using our `alertModal` from `AlertModelComp`, that says how many files/folders were successfully deleted.

### Step 20: Cut Button (completed)

Next you should implement the "Cut" button to make the global state remember what was cut, by holding the cut items file/folder names in a Set. So you'll create a new `GlobalState` array named `cutItems` as type `Set<string>`, and whenever the user has selected items with the checkboxes, and they click the "Cut" button, you will load `cutItems` with names of whatever's selected, and then clear the selections (i.e. clear `selectedTreeItems`). In this step we will not try to implement the server part yet, but just manage the local client-side state for now. The reason we keep `cutItems` in a set is for rapid lookup. Because what we can now do is inside our main loop of rendering items (i.e. line `{treeNodes.map((node, index) => (`) we can now check the `cutItems` set and simply skip over those in our loop, so that the page rendering will never contain any of the `cutItems`. So when the user clicks "Cut" button those selected items will vanish from the display.

### Step 21: Paste Button (doing this now)

Next you can make the "Paste" button work. We already have `cutItems` in global state from our previous step, so this paste operation will be simple. For the server side you'll implement a new HTTP POST endpoint named `/api/docs/paste` and as usual it will simply call a `Controller.ts` method. Make the `Controller.ts` method be called `pasteItems`. The object sent to the endpoint will contain two properties: 1) `targetFolder` which will contain `treeFolder` from our Global State, and 2) `pasteItems` which will be an array of file/folder names that are to be pasted into the `targetFolder`. On the server you can first check to see if any of the items are already in the target folder, and if so just throw an error, because the user should've navigated to a different folder before pasting. So doing the actual 'paste' itself will be done via a file rename (or move?) function on the OS. Before you start doing any file operations however, first make one pass over the array to determine if we're going to overwrite any files that already exist, and in that case throw an error. Our paste should fail if any files in the target folder would get overwritten, and we want to fail fast rather than doing part of it before we throw the error.

On the client side, after the paste, we can just refresh from the server in the normal way. We don't have any "Refresh" button yet on the client, but I think you will know how to refresh the entier folder view, because that code exists already. After the paste is complete you can show a message with `alertModal` that says how many were pasted.