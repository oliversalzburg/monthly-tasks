import { Credentials, OAuth2Client } from "google-auth-library";
import ElapsedTime from "elapsed-time";
import fs from "fs/promises";
import readline from "readline";
import { google } from "googleapis";
import { PersistedTask, Schedule, Task } from "./schedule";
import { DateTime } from "luxon";

// If modifying these scopes, delete token.json.
const SCOPES = [
  "https://www.googleapis.com/auth/tasks",
  "https://www.googleapis.com/auth/tasks",
];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = "token.json";
const TASKS_PATH = "tasks.yml";

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
 * @param credentials The authorization client credentials.
 */
async function authorize(credentials: ICredentials) {
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
 * @param oAuth2Client The OAuth2 client to get token for.
 */
async function getNewToken(oAuth2Client: OAuth2Client) {
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
    rl.question(
      "Enter the code from that page here: ",
      async (code: string) => {
        rl.close();
        const token = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(token.res?.data);
        // Store the token to disk for later program executions
        await fs.writeFile(TOKEN_PATH, JSON.stringify(token.res?.data));
        console.log("Token stored to", TOKEN_PATH);
        resolve(oAuth2Client);
      }
    );
  });
}

async function findMonthlyTasksList(client: OAuth2Client) {
  const service = google.tasks({ version: "v1", auth: client });

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

async function listTasks(client: OAuth2Client, tasklist: string) {
  const service = google.tasks({ version: "v1", auth: client });

  const tasks = await service.tasks.list({
    tasklist,
  });

  return tasks.data.items;
}

async function createMissingTasks(
  client: OAuth2Client,
  tasklist: string,
  existingTasks: Array<PersistedTask>,
  tasks: Array<Task>
) {
  for (const task of tasks) {
    const match = existingTasks.find(
      (candidate) =>
        candidate.title === task.title &&
        candidate.due === task.dueDate.toISOString()
    );

    if (match) {
      console.debug(
        ` ! ${task.title} - ${task.dueDate.toISOString()} already exists.`
      );
      continue;
    }

    await createMissingTask(client, tasklist, task);
  }
}

async function createMissingTask(
  client: OAuth2Client,
  tasklist: string,
  task: Task
) {
  const service = google.tasks({ version: "v1", auth: client });

  console.info(
    ` + Creating new task ${task.title} - ${task.dueDate.toISOString()}...`
  );
  await service.tasks.insert({
    tasklist,
    requestBody: {
      due: task.dueDate.toISOString(),
      title: task.title,
    },
  });
}

(async function main() {
  const entry = ElapsedTime.new().start();

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
  const existingTasks = await listTasks(client, taskList.id!);

  const firstDay = DateTime.now().startOf("month").startOf("day");
  const lastDay = DateTime.now().endOf("month").endOf("day");

  let schedule;
  try {
    schedule = await Schedule.fromFile(TASKS_PATH);
  } catch (error) {
    console.error(`No '${TASKS_PATH}' found. Exiting.`, error);
    process.exit(0);
  }

  console.info(
    `Generating schedule from ${firstDay.toISO()} to ${lastDay.toISO()}...`
  );

  schedule.print();

  const toCreate = schedule.forRange(firstDay.toJSDate(), lastDay.toJSDate());
  console.info(`Schedule produces ${toCreate.length} tasks.`);

  await createMissingTasks(client, taskList.id!, existingTasks ?? [], toCreate);

  console.info(`Process completed in ${entry.getValue()}.`);
})();
