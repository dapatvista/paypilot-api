ALTER TABLE `bills` ADD `due_day_of_month` int NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `last_reminder_for_due_date` date;