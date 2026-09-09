CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorUserId` int,
	`actorName` varchar(180),
	`action` varchar(80) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(255),
	`pageId` varchar(128),
	`threadId` varchar(255),
	`metadataJson` longtext,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'meta',
	`providerMessageId` varchar(255),
	`pageId` varchar(128) NOT NULL,
	`pageName` varchar(180),
	`threadId` varchar(255) NOT NULL,
	`senderId` varchar(255) NOT NULL,
	`senderType` enum('customer','admin','page','system') NOT NULL DEFAULT 'customer',
	`direction` enum('inbound','outbound') NOT NULL DEFAULT 'inbound',
	`text` longtext,
	`attachmentsJson` longtext,
	`adminUserId` int,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `chat_messages_provider_message_unique` UNIQUE(`provider`,`providerMessageId`)
);
--> statement-breakpoint
CREATE INDEX `audit_logs_actor_idx` ON `audit_logs` (`actorUserId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `audit_logs` (`entityType`,`entityId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `chat_messages_thread_idx` ON `chat_messages` (`pageId`,`threadId`,`occurredAt`);