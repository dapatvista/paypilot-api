CREATE TABLE `billers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(45) NOT NULL,
	`product_code` varchar(45) NOT NULL,
	`product_type` varchar(45),
	`form_schema` json,
	`logo_url` varchar(255),
	`status` enum('active','inactive') NOT NULL DEFAULT 'active',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `billers_product_code_idx` ON `billers` (`product_code`);--> statement-breakpoint
CREATE INDEX `billers_category_idx` ON `billers` (`category`);--> statement-breakpoint
CREATE INDEX `billers_status_idx` ON `billers` (`status`);