-- CreateEnum
CREATE TYPE "RankBranch" AS ENUM ('toccoa', 'enlisted', 'platoon_leader', 'xo', 'co', 'staff');

-- AlterTable
ALTER TABLE "Rank" ADD COLUMN     "branch" "RankBranch" NOT NULL DEFAULT 'enlisted';

-- Grades officiels de la communauté, du plus bas au plus haut (ordres espacés de 10 pour
-- pouvoir en intercaler). Rôle Discord à associer dans Admin > Paramètres.
INSERT INTO "Rank" ("id", "name", "abbreviation", "branch", "order", "iconUrl") VALUES
  (gen_random_uuid()::text, 'Private', 'Pvt.', 'toccoa', 10, '/insignes/pvt.svg'),
  (gen_random_uuid()::text, 'Private First Class', 'Pfc.', 'enlisted', 20, '/insignes/pfc.svg'),
  (gen_random_uuid()::text, 'Corporal', 'Cpl.', 'enlisted', 30, '/insignes/cpl.svg'),
  (gen_random_uuid()::text, 'Technician Fifth Grade', 'T/5.', 'enlisted', 40, '/insignes/t5.svg'),
  (gen_random_uuid()::text, 'Technician Fourth Grade', 'T/4.', 'enlisted', 50, '/insignes/t4.svg'),
  (gen_random_uuid()::text, 'Technician Third Grade', 'T/3.', 'enlisted', 60, '/insignes/t3.svg'),
  (gen_random_uuid()::text, 'Sergeant', 'Sgt.', 'platoon_leader', 70, '/insignes/sgt.svg'),
  (gen_random_uuid()::text, 'Staff Sergeant', 'S/Sgt.', 'platoon_leader', 80, '/insignes/ssgt.svg'),
  (gen_random_uuid()::text, 'Sergeant First Class', 'Sfc.', 'platoon_leader', 90, '/insignes/sfc.svg'),
  (gen_random_uuid()::text, '1st Sergeant', '1/Sgt.', 'xo', 100, '/insignes/1sgt.svg'),
  (gen_random_uuid()::text, 'Master Sergeant', 'M/Sgt.', 'xo', 110, '/insignes/msgt.svg'),
  (gen_random_uuid()::text, '2nd Lieutenant', '2Lt.', 'xo', 120, '/insignes/2lt.svg'),
  (gen_random_uuid()::text, '1st Lieutenant', '1Lt.', 'co', 130, '/insignes/1lt.svg'),
  (gen_random_uuid()::text, 'Captain', 'Cpt.', 'co', 140, '/insignes/cpt.svg'),
  (gen_random_uuid()::text, 'Major', 'Mjr.', 'co', 150, '/insignes/mjr.svg'),
  (gen_random_uuid()::text, 'Lieutenant Colonel', 'Lt.Col.', 'staff', 160, '/insignes/ltcol.svg'),
  (gen_random_uuid()::text, 'Colonel', 'Col.', 'staff', 170, '/insignes/col.svg')
ON CONFLICT DO NOTHING;
