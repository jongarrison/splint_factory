-- AlterTable
ALTER TABLE "PrintQueue" ADD COLUMN "progress" REAL;
ALTER TABLE "PrintQueue" ADD COLUMN "progressLastReportTime" DATETIME;
