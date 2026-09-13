-- CreateIndex
CREATE INDEX "Interaction_createdAt_idx" ON "Interaction"("createdAt");

-- CreateIndex
CREATE INDEX "Interaction_source_createdAt_idx" ON "Interaction"("source", "createdAt");
