CREATE TABLE "DiscordInteractionReceipt" (
    "id" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscordInteractionReceipt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DiscordInteractionReceipt_receivedAt_idx"
ON "DiscordInteractionReceipt"("receivedAt");
