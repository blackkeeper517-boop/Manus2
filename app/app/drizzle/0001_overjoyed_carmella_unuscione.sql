CREATE TABLE `vault_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`path` varchar(255) NOT NULL,
	`title` varchar(180) NOT NULL,
	`language` varchar(40) NOT NULL DEFAULT 'text',
	`kind` enum('code','sql','workflow','document','config','other') NOT NULL DEFAULT 'other',
	`content` longtext NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`isFavorite` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vault_files_id` PRIMARY KEY(`id`),
	CONSTRAINT `vault_files_project_path_unique` UNIQUE(`projectId`,`path`)
);
--> statement-breakpoint
CREATE TABLE `vault_projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`description` text,
	`category` varchar(80) NOT NULL DEFAULT 'project',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vault_projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `vault_projects_owner_slug_unique` UNIQUE(`ownerId`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `vault_revisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fileId` int NOT NULL,
	`projectId` int NOT NULL,
	`ownerId` int NOT NULL,
	`content` longtext NOT NULL,
	`checksum` varchar(64) NOT NULL,
	`sizeBytes` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vault_revisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `vault_files_project_idx` ON `vault_files` (`projectId`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `vault_files_owner_idx` ON `vault_files` (`ownerId`);--> statement-breakpoint
CREATE INDEX `vault_projects_owner_idx` ON `vault_projects` (`ownerId`);--> statement-breakpoint
CREATE INDEX `vault_revisions_file_idx` ON `vault_revisions` (`fileId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `vault_revisions_owner_idx` ON `vault_revisions` (`ownerId`);