-- ===========================================================================
--  SCHOOL PAY — Rôle PostgreSQL applicatif à privilèges réduits
--
--  L'application n'a besoin que de lire et écrire des données : elle ne crée
--  ni ne modifie jamais le schéma. Ce script crée donc un rôle qui ne peut
--  pas créer de base, de rôle, ni contourner les droits.
--
--  À exécuter UNE FOIS, en tant qu'administrateur (postgres), jamais avec le
--  rôle applicatif lui-même :
--
--     psql "$URL_ADMIN" -f db/roles.sql
--
--  Puis, dans .env.local / les variables d'hébergement, remplacez DATABASE_URL :
--
--     DATABASE_URL="postgresql://ecolepay_app:MOT_DE_PASSE_FORT@hote:5432/base"
--
--  Le mot de passe ci-dessous est un exemple : remplacez-le avant exécution.
--  Ne le commitez jamais.
-- ===========================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'ecolepay_app') then
    create role ecolepay_app
      login
      password 'REMPLACER_PAR_UN_MOT_DE_PASSE_FORT'
      nosuperuser
      nocreatedb
      nocreaterole
      noinherit;
  end if;
end
$$;

-- Connexion à la base courante uniquement.
do $$
begin
  execute format(
    'grant connect on database %I to ecolepay_app',
    current_database()
  );
end
$$;

-- Aucun objet n'est créé par l'application.
revoke create on schema public from public;
grant usage on schema public to ecolepay_app;

grant select, insert, update, delete
  on all tables in schema public
  to ecolepay_app;

grant usage, select
  on all sequences in schema public
  to ecolepay_app;

-- Tables et séquences créées plus tard par l'administrateur du schéma
-- (npm run db:push) restent accessibles au rôle applicatif.
alter default privileges in schema public
  grant select, insert, update, delete on tables to ecolepay_app;
alter default privileges in schema public
  grant usage, select on sequences to ecolepay_app;

-- Vérification rapide :
--   select rolname, rolsuper, rolcreatedb, rolcreaterole
--     from pg_roles where rolname = 'ecolepay_app';
-- doit renvoyer trois fois « false ».
