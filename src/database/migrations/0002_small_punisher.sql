CREATE TABLE `bills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`biller_id` int NOT NULL,
	`biller_account_number` varchar(128) NOT NULL,
	`label` varchar(255) NOT NULL,
	`estimated_monthly_amount` decimal(10,2) NOT NULL,
	`status` enum('active','archived') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `bills_user_id_idx` ON `bills` (`user_id`);--> statement-breakpoint
CREATE INDEX `bills_biller_id_idx` ON `bills` (`biller_id`);