-- CreateTable
CREATE TABLE "Store" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyDomain" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Quiz" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "logicType" TEXT NOT NULL DEFAULT 'basic',
    "settings" TEXT NOT NULL DEFAULT '{}',
    "styles" TEXT NOT NULL DEFAULT '{}',
    "productLimit" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quiz_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'radio',
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "description" TEXT,
    "image" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Answer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "questionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "image" TEXT,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "leadsToQuestionId" TEXT,
    "settings" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Answer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "image" TEXT,
    "order" INTEGER NOT NULL,
    "outcomeType" TEXT NOT NULL DEFAULT 'product',
    "outcomeData" TEXT NOT NULL DEFAULT '{}',
    "pointsFrom" INTEGER,
    "pointsTo" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Result_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultPath" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "logicOperator" TEXT NOT NULL DEFAULT 'AND',
    "order" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResultPath_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultPath_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultPathAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resultPathId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "answerId" TEXT NOT NULL,
    CONSTRAINT "ResultPathAnswer_resultPathId_fkey" FOREIGN KEY ("resultPathId") REFERENCES "ResultPath" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultPathAnswer_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerProduct" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    CONSTRAINT "AnswerProduct_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerProductWeight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "shopifyProductId" TEXT NOT NULL,
    "shopifyVariantId" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AnswerProductWeight_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnswerResultLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answerId" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "AnswerResultLink_answerId_fkey" FOREIGN KEY ("answerId") REFERENCES "Answer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnswerResultLink_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "Result" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quizId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "answers" TEXT NOT NULL,
    "resultId" TEXT,
    "recommendedProducts" TEXT NOT NULL,
    "marketingFields" TEXT NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Submission_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Submission_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnalyticsEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "questionId" TEXT,
    "answerId" TEXT,
    "data" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsEvent_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnalyticsEvent_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderAttribution" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "quizId" TEXT NOT NULL,
    "submissionId" TEXT,
    "shopifyOrderId" TEXT NOT NULL,
    "orderTotal" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Store_shopifyDomain_key" ON "Store"("shopifyDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_key_key" ON "Quiz"("key");

-- CreateIndex
CREATE INDEX "Quiz_storeId_idx" ON "Quiz"("storeId");

-- CreateIndex
CREATE INDEX "Question_quizId_idx" ON "Question"("quizId");

-- CreateIndex
CREATE INDEX "Answer_questionId_idx" ON "Answer"("questionId");

-- CreateIndex
CREATE INDEX "Answer_leadsToQuestionId_idx" ON "Answer"("leadsToQuestionId");

-- CreateIndex
CREATE INDEX "Result_quizId_idx" ON "Result"("quizId");

-- CreateIndex
CREATE INDEX "ResultPath_quizId_idx" ON "ResultPath"("quizId");

-- CreateIndex
CREATE INDEX "ResultPath_resultId_idx" ON "ResultPath"("resultId");

-- CreateIndex
CREATE UNIQUE INDEX "ResultPathAnswer_resultPathId_questionId_answerId_key" ON "ResultPathAnswer"("resultPathId", "questionId", "answerId");

-- CreateIndex
CREATE INDEX "AnswerProduct_answerId_idx" ON "AnswerProduct"("answerId");

-- CreateIndex
CREATE INDEX "AnswerProductWeight_answerId_idx" ON "AnswerProductWeight"("answerId");

-- CreateIndex
CREATE INDEX "AnswerResultLink_answerId_idx" ON "AnswerResultLink"("answerId");

-- CreateIndex
CREATE INDEX "AnswerResultLink_resultId_idx" ON "AnswerResultLink"("resultId");

-- CreateIndex
CREATE INDEX "Submission_quizId_idx" ON "Submission"("quizId");

-- CreateIndex
CREATE INDEX "Submission_storeId_idx" ON "Submission"("storeId");

-- CreateIndex
CREATE INDEX "Submission_sessionId_idx" ON "Submission"("sessionId");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_quizId_createdAt_idx" ON "AnalyticsEvent"("quizId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");

-- CreateIndex
CREATE INDEX "OrderAttribution_quizId_idx" ON "OrderAttribution"("quizId");

-- CreateIndex
CREATE INDEX "OrderAttribution_submissionId_idx" ON "OrderAttribution"("submissionId");
