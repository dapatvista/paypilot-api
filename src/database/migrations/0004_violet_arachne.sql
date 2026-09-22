CREATE TABLE `reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`bill_id` int NOT NULL,
	`scheduled_for` datetime NOT NULL,
	`status` enum('scheduled','sent','cancelled','failed') NOT NULL DEFAULT 'scheduled',
	`external_message_ref` varchar(128),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `reminders_bill_id_idx` ON `reminders` (`bill_id`);--> statement-breakpoint
CREATE INDEX `reminders_scheduled_for_idx` ON `reminders` (`scheduled_for`);