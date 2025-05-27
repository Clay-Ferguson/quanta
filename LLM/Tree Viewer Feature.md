# Notes to Copilot AI Agent about the `Tree Viewer` Feature

This document contains notes to explain to our Coding Agent (Github Copilot running inside this VSCode), how to implement the new `Tree Viewer` Feature. We will let the agent complete this feature one step at a time, as shown below, in the steps after the overview.

Current Status of this feature: The LLM is about to do "Step #10"

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