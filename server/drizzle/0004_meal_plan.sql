CREATE TABLE `plan_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`row_id` integer NOT NULL,
	`recipe_id` integer,
	`label` text NOT NULL,
	`position` integer NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`row_id`) REFERENCES `plan_rows`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_entries_date_idx` ON `plan_entries` (`date`);--> statement-breakpoint
CREATE INDEX `plan_entries_recipe_idx` ON `plan_entries` (`recipe_id`,`date`);--> statement-breakpoint
CREATE TABLE `plan_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`from_date` text NOT NULL,
	`to_date` text NOT NULL,
	`away` integer NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `plan_events_range_idx` ON `plan_events` (`from_date`,`to_date`);--> statement-breakpoint
CREATE TABLE `plan_rows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL
);
