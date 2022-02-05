import YAML from "yaml";
import fs from "fs/promises";
import { RRule, RRuleSet, rrulestr } from "rrule";

export class ScheduleEntry {
  title: string;
  recurrence: RRule;

  constructor(title: string, recurrence: RRule) {
    this.title = title;
    this.recurrence = recurrence;
  }
}

export type Task = {
  title: string;
  dueDate: Date;
};

export type PersistedTask = {
  title?: string | null | undefined;
  due?: string | null | undefined;
};

export class Schedule {
  tasks = new Array<ScheduleEntry>();

  add(title: string, recurrence: RRule) {
    this.tasks.push(new ScheduleEntry(title, recurrence));
  }

  print() {
    for (const task of this.tasks) {
      console.info(` - ${task.title} - ${task.recurrence.toText()}`);
    }
  }

  forRange(start: Date, end: Date) {
    const entries = new Array<Task>();
    for (const task of this.tasks) {
      const dates = task.recurrence.between(start, end);
      for (const date of dates) {
        entries.push({
          title: task.title,
          dueDate: date,
        });
      }
    }
    return entries;
  }

  static async fromFile(path: string) {
    const configData = await fs.readFile(path, "utf-8");
    const config = YAML.parse(configData);
    const schedule = new Schedule();
    for (const task of config.tasks) {
      schedule.add(
        task.title,
        new RRule({
          byweekday: task.byweekday.map(decodeWeekday),
          dtstart: new Date(Date.UTC(2000, 1, 1, 0, 0)),
          freq: decodeFrequency(task.freq),
          interval: task.interval ?? 1,
        })
      );
    }

    return schedule;
  }
}

function decodeFrequency(frequency: string) {
  switch (frequency) {
    case "daily":
      return RRule.DAILY;

    case "weekly":
      return RRule.WEEKLY;

    case "monthly":
      return RRule.MONTHLY;
  }

  throw new Error(`Frequency '${frequency}' is not understood.`);
}

function decodeWeekday(weekday: string) {
  switch (weekday) {
    case "MO":
      return RRule.MO;

    case "TU":
      return RRule.TU;

    case "WE":
      return RRule.WE;

    case "TH":
      return RRule.TH;

    case "FR":
      return RRule.FR;

    case "SA":
      return RRule.SA;

    case "SU":
      return RRule.SU;
  }

  throw new Error(`Week day '${weekday}' is not understood.`);
}
