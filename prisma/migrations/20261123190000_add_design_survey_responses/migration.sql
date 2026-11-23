CREATE TABLE "DesignSurveyResponse" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedByUserId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionKey" UUID NOT NULL,
    "designId" TEXT NOT NULL,
    "objectId" TEXT,
    "formVersion" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "adminNote" TEXT,
    "lastReviewedByUserId" TEXT,
    "lastReviewedByName" TEXT,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "DesignSurveyResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DesignSurveyResponse_submittedByUserId_submissionKey_key" ON "DesignSurveyResponse"("submittedByUserId", "submissionKey");
CREATE INDEX "DesignSurveyResponse_createdAt_id_idx" ON "DesignSurveyResponse"("createdAt", "id");

ALTER TABLE "DesignSurveyResponse" ADD CONSTRAINT "DesignSurveyResponse_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignSurveyResponse" ADD CONSTRAINT "DesignSurveyResponse_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignSurveyResponse" ADD CONSTRAINT "DesignSurveyResponse_designId_fkey" FOREIGN KEY ("designId") REFERENCES "NamedGeometry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignSurveyResponse" ADD CONSTRAINT "DesignSurveyResponse_lastReviewedByUserId_fkey" FOREIGN KEY ("lastReviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
