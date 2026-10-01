ALTER TABLE "patients"
  ADD COLUMN "first_name" VARCHAR(100),
  ADD COLUMN "last_name" VARCHAR(100),
  ADD COLUMN "nickname" VARCHAR(120),
  ADD COLUMN "age" INTEGER,
  ADD COLUMN "faculty" VARCHAR(120),
  ADD COLUMN "branch" VARCHAR(120),
  ADD COLUMN "visitor_type" VARCHAR(30),
  ADD COLUMN "visitor_detail" VARCHAR(200),
  ADD COLUMN "gender" VARCHAR(40),
  ADD COLUMN "blood" VARCHAR(10),
  ADD COLUMN "weight" DECIMAL(7, 2),
  ADD COLUMN "height" DECIMAL(7, 2);
