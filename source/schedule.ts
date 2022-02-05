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
}

const schedule = new Schedule();

schedule.add(
  "Pflanzen gießen",
  new RRule({
    freq: RRule.WEEKLY,
    interval: 1,
    byweekday: [RRule.SU],
    dtstart: new Date(Date.UTC(2000, 1, 1, 0, 0)),
  })
);

schedule.add(
  "Orchideen tauchen",
  new RRule({
    freq: RRule.WEEKLY,
    interval: 2,
    byweekday: [RRule.SU],
    dtstart: new Date(Date.UTC(2000, 1, 1, 0, 0)),
  })
);

export { schedule };
