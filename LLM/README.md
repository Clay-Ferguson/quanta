# Using LLMs to Write Code 

## Notes to Humans

*NOTE: The LLMs folder where you are reading this is *not* part of the actual implementation of the application, or used by the application. This folder contains only AI prompts that are helpful for AI-Assisted coding related to adding features to this app. So you can completely delete the LLM folder and it will not affect the app at all.*

## About the Markdown Files

The markdown files in this folder are how you can provide LLMs enough information to do a specific kind of repetitive task, or refactoring that's often done in the code. The really nice thing about these Markdown files is that not only are they exactly that an LLM needs to work on the code, but it's also perfect information to explain to humans about the system architecture, just as basic documentation or onboardig instructions would.

## How to Use

The way you use these markdown files is simple: All you would do is open ONE of these LLM markdown files, in your IDE, and close other files. Then with that one file as the default "context" provided to the LLM (merely because it's open in your IDE, and the active file) when you start a discussion with Microsoft Github Copilot in VSCode for example, you can ask it do do one of the things the markdown tells it how to do, and it will then proceed to walk you thru the task to accomplish something with you like a teammate would. It will ask you for input when it needs info, but then you are essentially just babysitting it and overseeing it as it proceeds to accomplish the task.

There's no fancy agents involved that you need to think about yourself, because it's all accomplished via that initial prompt of instructions, and steps, to accomplish some goal.