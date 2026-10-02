UPDATE "patients"
SET "visitor_type" = CASE "visitor_type"
  WHEN 'student' THEN 'บุคคลภายใน'
  WHEN 'guest' THEN 'บุคคลภายนอก'
END
WHERE "visitor_type" IN ('student', 'guest');
