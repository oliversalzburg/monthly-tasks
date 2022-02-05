import { Credentials, OAuth2Client } from "google-auth-library";

import fs from "fs/promises";
import readline from "readline";
import { google } from "googleapis";

// If modifying these scopes, delete token.json.
const SCOPES = ["https://www.googleapis.com/auth/tasks.readonly"];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";

type ICredentials = {
  installed: {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: Array<string>;
  };
};

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
async function authorize(
  credentials: ICredentials
) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    const token = await fs.readFile(TOKEN_PATH);

    oAuth2Client.setCredentials(JSON.parse(token.toString()));
    return oAuth2Client;

  } catch (err) {
    return getNewToken(oAuth2Client);
  }
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
async function getNewToken(
  oAuth2Client: OAuth2Client
) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<OAuth2Client>((resolve, reject) => {
    rl.question("Enter the code from that page here: ", async (code: string) => {
      rl.close();
      const token = await oAuth2Client.getToken(
        code
      );
      oAuth2Client.setCredentials(token.res?.data);
      // Store the token to disk for later program executions
      await fs.writeFile(TOKEN_PATH, JSON.stringify(token));
      console.log("Token stored to", TOKEN_PATH);
      resolve(oAuth2Client);
    });
  });
}

/**
 * Lists the user's first 10 task lists.
 *
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listTaskLists(auth: OAuth2Client) {
  const service = google.tasks({ version: "v1", auth });

  service.tasklists.list(
    {
      maxResults: 10,
    },
    (err, res) => {
      if (err) return console.error("The API returned an error: " + err);
      const taskLists = res!.data.items;
      if (taskLists) {
        console.log("Task lists:");
        taskLists.forEach((taskList) => {
          console.log(`${taskList.title} (${taskList.id})`);
          listTasks(auth, taskList.id!);
        });
      } else {
        console.log("No task lists found.");
      }
    }
  );
}

async function findMonthlyTasksList(auth: OAuth2Client) {
  const service = google.tasks({ version: "v1", auth });

  const taskLists = await service.tasklists.list({
    maxResults: 10,
  });

  for (const taskList of taskLists.data.items!) {
    if (taskList.title === "Monthly Tasks") {
      return taskList;
    }
  }

  return null;
}

async function listTasks(auth: OAuth2Client, tasklist: string) {
  const service = google.tasks({ version: "v1", auth });

  const tasks = await service.tasks.list(
    {
      tasklist,
    });
  console.log(tasks.data);
}

(async function main() {
  // Load client secrets from a local file.
  const content = await fs.readFile("credentials.json");
  const client = await authorize(JSON.parse(content.toString()));

  console.info(`Searching for Monthly Tasks list...`);
  const taskList = await findMonthlyTasksList(client);
  if (!taskList) {
    console.error("Monthly Tasks list is missing!");
    process.exit(1);
  }

  console.info(`Listing existing tasks in list ${taskList.id}...`);
  await listTasks(client, taskList.id!);
})()