CREATE TABLE `biller_push_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`payment_id` int NOT NULL,
	`request_payload` json,
	`response_payload` json,
	`result_code` varchar(45),
	`result_description` varchar(255),
	`status` enum('success','failed') NOT NULL,
	`attempted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `biller_push_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`bill_id` int NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'myr',
	`stripe_payment_intent_id` varchar(255),
	`status` enum('pending','succeeded','failed','cancelled') NOT NULL DEFAULT 'pending',
	`biller_push_status` enum('pending','success','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_stripe_payment_intent_id_idx` UNIQUE(`stripe_payment_intent_id`)
);
--> statement-breakpoint
CREATE INDEX `biller_push_attempts_payment_id_idx` ON `biller_push_attempts` (`payment_id`);--> statement-breakpoint
CREATE INDEX `payments_user_id_idx` ON `payments` (`user_id`);--> statement-breakpoint
CREATE INDEX `payments_bill_id_idx` ON `payments` (`bill_id`);