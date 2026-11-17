ALTER TABLE `comments` ADD `rating` integer;--> statement-breakpoint
-- Notes carried over from v1 start with typed stars ("★★★★☆ · text"): turn them into real ratings.
UPDATE `comments` SET
  `rating` = length(substr(`body`, 1, 5)) - length(replace(substr(`body`, 1, 5), '★', '')),
  `body` = trim(substr(`body`, 9))
WHERE `rating` IS NULL
  AND substr(`body`, 1, 5) NOT GLOB '*[^★☆]*'
  AND length(substr(`body`, 1, 5)) = 5
  AND substr(`body`, 6, 3) = ' · '
  AND instr(substr(`body`, 1, 5), '★') > 0;
