CREATE TABLE `product_aliases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerId` int NOT NULL,
	`alias` varchar(180) NOT NULL,
	`canonicalSku` varchar(120) NOT NULL,
	`canonicalLabel` varchar(255) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `product_aliases_id` PRIMARY KEY(`id`),
	CONSTRAINT `product_aliases_owner_alias_unique` UNIQUE(`ownerId`,`alias`)
);
--> statement-breakpoint
CREATE INDEX `product_aliases_owner_idx` ON `product_aliases` (`ownerId`,`updatedAt`);