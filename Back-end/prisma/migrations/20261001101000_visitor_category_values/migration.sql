BEGIN;
UPDATE "InfirmaryVisit"
SET "visitorType" = CASE "visitorType"
  WHEN 'student' THEN 'บุคคลภายใน'
  WHEN 'guest' THEN 'บุคคลภายนอก'
  ELSE "visitorType" END,
  "version" = "version" + 1
WHERE "visitorType" IN ('student', 'guest');
ALTER TABLE "InfirmaryVisit" ADD CONSTRAINT "InfirmaryVisit_visitorType_check"
  CHECK ("visitorType" IN ('บุคคลภายใน', 'บุคคลภายนอก'));
COMMIT;
