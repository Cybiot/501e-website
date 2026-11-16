-- Insignes officiels de la communauté (apps/web/public/insignes/501e_*.png) à la place des
-- placeholders SVG. Le Pvt n'a pas encore d'insigne officiel : il garde /insignes/pvt.svg.
-- Repère : l'ancien placeholder, ou à défaut l'abréviation pour un grade créé sans insigne.
UPDATE "Rank" r
SET "iconUrl" = '/insignes/501e_' || m.slug || '.png'
FROM (VALUES
  ('pfc', 'Pfc.'),
  ('cpl', 'Cpl.'),
  ('t5', 'T/5.'),
  ('t4', 'T/4.'),
  ('t3', 'T/3.'),
  ('sgt', 'Sgt.'),
  ('ssgt', 'S/Sgt.'),
  ('sfc', 'Sfc.'),
  ('1sgt', '1/Sgt.'),
  ('msgt', 'M/Sgt.'),
  ('2lt', '2Lt.'),
  ('1lt', '1Lt.'),
  ('cpt', 'Cpt.'),
  ('mjr', 'Mjr.'),
  ('ltcol', 'Lt.Col.'),
  ('col', 'Col.')
) AS m(slug, abbreviation)
WHERE r."iconUrl" = '/insignes/' || m.slug || '.svg'
   OR (r."iconUrl" IS NULL AND r."abbreviation" = m.abbreviation);
