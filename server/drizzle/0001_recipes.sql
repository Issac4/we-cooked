CREATE TABLE `recipe_tags` (
	`recipe_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag_id`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_tags_tag_idx` ON `recipe_tags` (`tag_id`,`recipe_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`other_name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`cover_photo` text,
	`servings` integer,
	`prep_mins` integer,
	`cook_mins` integer,
	`ingredients` text NOT NULL,
	`steps` text NOT NULL,
	`links` text NOT NULL,
	`needs_review` integer DEFAULT false NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	`updated_by` integer,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`deleted_by` integer,
	FOREIGN KEY (`cover_photo`) REFERENCES `uploads`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `recipes_deleted_idx` ON `recipes` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `recipes_created_idx` ON `recipes` (`created_at`);--> statement-breakpoint
CREATE TABLE `tag_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`position` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_groups_name_key_unique` ON `tag_groups` (`name_key`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`position` integer NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `tag_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_group_name_idx` ON `tags` (`group_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`bytes` integer NOT NULL,
	`created_by` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
