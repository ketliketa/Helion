CREATE TABLE `channel_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`channel` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`result` text DEFAULT '' NOT NULL,
	`created` text NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE no action
);
