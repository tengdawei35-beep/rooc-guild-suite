/*
  Warnings:

  - You are about to drop the column `displayName` on the `GuildMember` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "GuildMember_guildId_displayName_key";

-- AlterTable
ALTER TABLE "GuildMember" DROP COLUMN "displayName";
