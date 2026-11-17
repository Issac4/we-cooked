CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`color` text NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_name_key_unique` ON `collections` (`name_key`);--> statement-breakpoint
CREATE TABLE `recipe_collections` (
	`recipe_id` integer NOT NULL,
	`collection_id` integer NOT NULL,
	`added_at` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `collection_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_collections_collection_idx` ON `recipe_collections` (`collection_id`,`recipe_id`);