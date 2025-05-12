# Instructions for AI/LLMs

When you are doing a new task, you will walk the user thru each of these steps one at a time, before moving to the next step. Don't mention future steps until you've done all prior steps. Always tell the user in each reply which step we're currently on, and what info you need from them to complete the current step, if any. If there's no input required from the user, just do the step, and then before moving to the next step ask the user to confirm with "yes" that the are ready for beginning the next step. This way you always stay focused on completeing any given step until the user has specifically said they're ready to move on to next step.

## How to add a new Web Page

When you are asked to add a new page, here are the steps:

Step #1: The first step is to update file `/src/AppServiceTypes.ts` by adding the appropriate new 'enum' entry into the `PageNames` enum.  

Step #2: The next step is to look at the example page named `/src/pages/AdminPage.tsx` to understand how to do the main page layout, including the back button, and then create the new page file following that example, only for the overall styling and layout.

Notice we're using TailwindCSS for styling. Notice where `AdminPage.tsx` has `div`, `header`, `LogoBlockComp`, `BackButtonComp`, and don't deviate from that exact pattern. Try to use the same elements in the same way.

Before you create the new page file however, you should ask the user to provide the file name for the page. Then when they answer with the page name you will create the file, in your usual way by replying back with the entire content for that file, and letting the user accept it using their normal way of creating the new file. Don't assume you know how to actually implement the file, just make the content area of any new page be empty, unless you're given more info about how to construct the page.

Step #3: Inside the 'main.tsx' we need to update the `PageRouter` function, and it should be obvious how to do this. It simply will return the function component we just created for the case of the `PageName` enum item we just created. This is essentially what makes the page able to display of course.
 
## Opening a Page

Here's how we open a page from any element:

```
onClick={() => app.goToPage(PageNames.settings)}
```

That example is how we would make a button open the "settings" page of course. And the way we get access to 'app' anywhere we need it is by this simple import:

```
import {app} from '../AppService';
```


