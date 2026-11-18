-- CreateTable
CREATE TABLE "PreferredRoster" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "EventType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferredRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferredRosterParty" (
    "id" TEXT NOT NULL,
    "preferredRosterId" TEXT NOT NULL,
    "battlefield" "Battlefield" NOT NULL,
    "partyNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferredRosterParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreferredRosterMember" (
    "id" TEXT NOT NULL,
    "preferredRosterPartyId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "slotNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreferredRosterMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreferredRoster_guildId_idx" ON "PreferredRoster"("guildId");

-- CreateIndex
CREATE INDEX "PreferredRoster_type_idx" ON "PreferredRoster"("type");

-- CreateIndex
CREATE UNIQUE INDEX "PreferredRoster_guildId_type_key" ON "PreferredRoster"("guildId", "type");

-- CreateIndex
CREATE INDEX "PreferredRosterParty_preferredRosterId_idx" ON "PreferredRosterParty"("preferredRosterId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferredRosterParty_preferredRosterId_battlefield_partyNum_key" ON "PreferredRosterParty"("preferredRosterId", "battlefield", "partyNumber");

-- CreateIndex
CREATE INDEX "PreferredRosterMember_preferredRosterPartyId_idx" ON "PreferredRosterMember"("preferredRosterPartyId");

-- CreateIndex
CREATE INDEX "PreferredRosterMember_memberId_idx" ON "PreferredRosterMember"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "PreferredRosterMember_preferredRosterPartyId_slotNumber_key" ON "PreferredRosterMember"("preferredRosterPartyId", "slotNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PreferredRosterMember_preferredRosterPartyId_memberId_key" ON "PreferredRosterMember"("preferredRosterPartyId", "memberId");

-- AddForeignKey
ALTER TABLE "PreferredRoster" ADD CONSTRAINT "PreferredRoster_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredRosterParty" ADD CONSTRAINT "PreferredRosterParty_preferredRosterId_fkey" FOREIGN KEY ("preferredRosterId") REFERENCES "PreferredRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredRosterMember" ADD CONSTRAINT "PreferredRosterMember_preferredRosterPartyId_fkey" FOREIGN KEY ("preferredRosterPartyId") REFERENCES "PreferredRosterParty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreferredRosterMember" ADD CONSTRAINT "PreferredRosterMember_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GuildMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
