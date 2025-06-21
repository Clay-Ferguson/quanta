# Notes to Copilot AI Agent about Converting SQLite3 to Postgres

Note: This file contains information and instructions for the Github Copilot Agent to use to perform the below refactorings on this project:

Our chat plugin currently uses SQLite3. 

This is what we're currently doing in this project: We're converting the chat plugin SQLite code to Postres. The common Postgres database connection code is found in '/server/PDGB.ts', and will be used for all plugins, for non-plugin specific code. However we're focusing right now only on the 'chat' plugin and specifically the files in '/server/plugins/chat/db'. We will be doing this conversion one step at a time, and we won't expect the code to be able to fully run the 'chat' plugin again until all steps are complete.

Here are the steps (below). Right now we are doing Step #7.

## Step 1 (completed)

In this step we need to move the SQL DDL commands from the 'DBManager.ts' 'initialize' function into a 'schema.sql' file, and import 'pgdb' (from 'PGDB.ts') into the 'DBManager.ts' file so that we call the commands in the 'schema.sql' file using the 'pgdb' imported module, to run SQL. Please don't be tempted to go ahead and convert the rest of the file yet. I just want this first step to consist only of moving the schema into a 'schema.sql' file, inside the 'plugins/chat' folder. Importantly you'll need to alter the SQL as well to make it be PostgreSQL SQL rather than SQLite SQL. By the way, you can search the code for 'schema.sql' to see how we're doing it in the 'plugins/docs' plugin if you have any questions.

### Step Outcome Notes: 
* You created the chat plugin schema in `/server/plugins/chat/schema.sql`

## Step 2 (completed)

In this step please look at our `Transactional.ts` file where we had a decorator for doing transactions in SQLite3, and if that still has any value in PostgreSQL then make it do the PostgreSQL equivalent of what it's doing now. If we don't need it, just tell me we don't and I will take care of removing it myself.

Step Outcome Notes: 
* You kept `Transational.ts` and made it Postgres compliant.

## Step 3 (completed)

Please convert `DBAttachments.ts` to Postgre. You should be able to keep almost identical SQL inline right in the code as it is now, and then simply import `pgdb` to get the connection of course, and run the SQL with.

## Step 4 (completed)

Please convert `DBRoom.ts` to Postgre. You should be able to keep almost identical SQL again, of course.

## Step 5 (completed)

Please convert `DBMessages.ts` to Postgre.

## Step 6 (completed)

Please convert `DBUsers.ts` to Postgre.

## Step 7 - Troubleshooting Conversion Problems

Problems identified during testing:

currently none, this entire feature set and all 6 steps are completed