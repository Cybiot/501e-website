-- Séparé de l'ajout de la valeur d'enum : PostgreSQL interdit de l'utiliser dans la même transaction.
INSERT INTO "Rank" ("id", "name", "abbreviation", "branch", "order", "iconUrl") VALUES
  (gen_random_uuid()::text, 'Vétéran', 'Vet.', 'veteran', 0, NULL)
ON CONFLICT DO NOTHING;
