# Notes to Copilot AI Agent about the `Tree Viewer` Feature

This document contains notes to explain to our Coding Agent (Github Copilot running inside this VSCode), how to implement the new `Tree Viewer` Feature. We will let the agent complete this feature one step at a time, as shown below, in the steps after the overview.

Current Status of this feature: The LLM is about to do "Step #2"

## Overview

This feature will let the user view a server-side folder as an array of Markdown elements on the `TreeViewerPage` of this app. For example if there are 10 files in the server-side folder, we will have 10 separate `Markdown` components on the tree viewer page, displayed vertically one after the other. The goal is to present a folder to the user, as if it was one big file. If we encounter any images in our directory listing then the image will be represented as an <IMG> tag of course, with the url to that file.

The `GlobalState` variable named `treeFolder` controls which folder is currently being viewed. We will have a server endpoint named `/api/docs/render/${treeFolder}`, as it's URL path, exposed as a `get` HTTP method which accepts, the name of the folder to be rendered, relative to the `QUANTA_TREE_ROOT` (which is an environment variable on the server). So the absolute path of the folder to be rendered would be a string `${QUANTA_TREE_ROOT}${treeFolder}`, which is just the concatenation of course.

## Steps

### Step 1: (already completed)

For this first step, here are the instructions to the AI Agent for what to do:

* Create the 'get' method in 'ChatServer.ts' that calls a Controller method (that you'll create) named 'treeRender'.
* The 'treeRender' should return an array of objects representing each 'file' that was found in the 'treeFolder'
* The array should be properly typed with each element in the array being a 'TreeNode' type.
* The TreeNode type (that you will define), will have, 'createTime (number), modifyTime (number), content (string), mimeType (string)'.
* When the TreeNode array is generated we assume every file is either text or an image, and we detect images as file extensions 'png, jpeg, jpg'
* The TreeNode items will also be sorted alphabetically by filename.

Summary: So we're just creating a way to let the browser/client request a directory listing and we're sending back the array that represents the files and folders. Be sure to put the implementation itself in the 'Controller.ts' file, not in the 'ChatServer.ts' file. By the way, please don't try to run the app yourself, to test this stuff. Just write the code and I'll run and test it.

STATUS UPDATE: Step 1 has been completed. `TreeRender_Response` is the type of what this endpoint responds with.

### Step 2: (doing this now)

In this step you will add basic rendering in `TreeViewerPage` component, by calling the endpoint to get the array of file content first, inside the partially implemented `fetchTree` method. In the place we currently have a `Markdown` react component in there just to prove the page works, we need to adjust that to instead iterate over the `TreeNode` array and display each one in a separate `Markdown` component, for all mimeTypes that are not images. For mime types which are images, we should display them in an HTML IMG tag instead of a `Markdown` component. Take your best guess at getting the URL correct for the image URLs, but as long as it's close I can fix it. I mean, the relative path aspect of the images might be tricky so just take your first guess at it, because it will be easy for me to fix that later. I will also probably adjust my endpoint to have a specific URL just for these document images, and that step hasn't been done yet. It will probably be in Step 3. So now that I think of it, just a placeholder URL that doesn't even work yet will be fine.