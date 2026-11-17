-- ===========================================================================
--  ECOLE PAY — Schéma PostgreSQL (v1)
--  Compatible Neon, Supabase et PostgreSQL 15+.
--
--  Principes :
--   • Une seule base héberge toutes les écoles (multi-tenant).
--   • L'isolation est garantie à deux niveaux :
--       1. chaque requête applicative filtre sur ecole_id (voir src/lib/db.ts) ;
--       2. les clés étrangères composites (id, ecole_id) rendent impossible le
--          rattachement d'un élève / paiement à une autre école.
--   • Une classe choisit sa fréquence : MENSUEL (10 périodes), TRANCHES
--     (autant de tranches que l'école le souhaite, montants et dates libres)
--     ou ANNUEL (1 période). `montant_periode` ne sert qu'au mensuel et à
--     l'annuel : les tranches vivent dans la table `tranches`.
--   • `frais` = ce que l'élève doit pour une échéance (un mois, une tranche ou
--     l'année), plus une ligne spéciale INSCRIPTION ou REINSCRIPTION
--     (période 0) créée à l'inscription.
--   • Chaque échéance porte un `libelle` figé (« Septembre », « 1ère tranche »,
--     « Année 2026-2027 ») : le reçu et l'historique restent justes même si
--     l'école renomme ensuite ses tranches.
--   • `paiements` conserve un instantané de la période et de la nature, même si
--     la classe change ensuite.
--   • Le montant payé et le statut de `frais` sont recalculés par trigger :
--     impossible d'avoir un total incohérent, même en cas de bug applicatif.
--
--  Exécution : npm run db:push   (ou coller ce fichier dans l'éditeur SQL Neon)
-- ===========================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. ÉCOLES (le client payant)
-- ---------------------------------------------------------------------------
create table if not exists ecoles (
  id              uuid primary key default gen_random_uuid(),
  nom             text        not null,
  adresse         text,
  telephone       text,
  email           text        not null,
  logo_url        text,                                   -- URL ou data:image (logo < 200 Ko)
  plan            text        not null default 'essai'
                  check (plan in ('essai', 'petite', 'moyenne', 'grosse')),
  -- Offre commerciale : STARTER, PRO ou PREMIUM. Pendant l'essai, l'école
  -- dispose temporairement de toutes les fonctions PREMIUM.
  offre           text        not null default 'PREMIUM',
  -- Activation commerciale pilotée par le super admin.
  statut              text    not null default 'ESSAI'
                      check (statut in ('ESSAI', 'ACTIF', 'BLOQUE')),
  date_fin_essai      date    default (current_date + interval '30 days'),
  date_fin_abonnement date,
  actif           boolean     not null default true,
  recu_compteur   integer     not null default 0,          -- numérotation des reçus
  modele_recu     text        not null default
    E'{ecole}\nREÇU DE PAIEMENT N° {recu}\n{date}\n--------------------------------\nÉlève : {eleve}\nClasse : {classe}\nParent : {parent}\nObjet : {nature} · {periode}\nAnnée scolaire : {annee}\n--------------------------------\nMontant reçu : {montant}\nMode de paiement : {mode}\nReste à payer : {reste}\n--------------------------------\nMerci de conserver ce reçu.',
  modele_relance  text        not null default
    'Bonjour, rappel : {nature} {periode} de {eleve} ({montant_du}) n''est pas encore réglé. Reste : {reste}. Merci de passer à la comptabilité. - {ecole}',
  date_creation   timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists ecoles_email_unique on ecoles (lower(email));

-- ---------------------------------------------------------------------------
-- 2. UTILISATEURS (directeur + secrétaires), rattachés à une école
-- ---------------------------------------------------------------------------
create table if not exists users (
  id                uuid primary key default gen_random_uuid(),
  ecole_id          uuid        not null references ecoles (id) on delete cascade,
  nom               text        not null,
  email             text        not null,
  mot_de_passe      text        not null,                 -- hash bcrypt
  role              text        not null check (role in ('directeur', 'secretaire', 'comptable')),
  actif             boolean     not null default true,
  token_version     integer     not null default 0,        -- invalide les sessions après changement de mot de passe
  derniere_connexion timestamptz,
  date_creation     timestamptz not null default now(),
  unique (id, ecole_id)
);

create unique index if not exists users_email_unique on users (lower(email));
create index if not exists users_ecole_idx on users (ecole_id);

-- ---------------------------------------------------------------------------
-- 3. CLASSES
--    montant_periode = tarif d'un mois ou d'une année (0 pour les tranches).
-- ---------------------------------------------------------------------------
create table if not exists classes (
  id                 uuid primary key default gen_random_uuid(),
  ecole_id           uuid        not null references ecoles (id) on delete cascade,
  nom                text        not null,
  montant_periode    integer     not null default 0 check (montant_periode >= 0),
  frequence_paiement text        not null default 'MENSUEL'
                     check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL')),
  frais_inscription  integer     not null default 0 check (frais_inscription >= 0),
  frais_reinscription integer    not null default 0 check (frais_reinscription >= 0),
  ordre              integer     not null default 0,
  date_creation      timestamptz not null default now(),
  unique (id, ecole_id),
  unique (ecole_id, nom)
);

create index if not exists classes_ecole_idx on classes (ecole_id);

-- ---------------------------------------------------------------------------
-- 3 bis. TRANCHES (versements libres propres à une classe)
--   Au Togo, une école ne découpe pas l'année en trimestres égaux : elle
--   demande une 1re tranche en octobre, une 2e en janvier, etc., avec des
--   montants différents. Chaque classe définit donc sa propre liste.
-- ---------------------------------------------------------------------------
create table if not exists tranches (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid        not null references ecoles (id) on delete cascade,
  classe_id     uuid        not null,
  ordre         smallint    not null check (ordre between 1 and 20),
  nom           text        not null,
  montant       integer     not null default 0 check (montant >= 0),
  date_limite   date,
  date_creation timestamptz not null default now(),
  unique (id, ecole_id),
  unique (classe_id, ordre),
  constraint tranche_classe_ecole_fk
    foreign key (classe_id, ecole_id) references classes (id, ecole_id)
    on delete cascade
);

create index if not exists tranches_classe_idx on tranches (classe_id, ordre);

-- ---------------------------------------------------------------------------
-- 4. ÉLÈVES
--    telephone_parent stocké sur 8 chiffres (ex: 90123456).
--    type_inscription distingue un nouvel élève d'un ancien élève.
-- ---------------------------------------------------------------------------
create table if not exists eleves (
  id               uuid primary key default gen_random_uuid(),
  ecole_id         uuid        not null references ecoles (id) on delete cascade,
  classe_id        uuid        not null,
  nom              text        not null,
  prenom           text        not null,
  sexe             text        check (sexe in ('M', 'F')),
  nom_parent       text        not null,
  telephone_parent text        not null,
  annee_scolaire   text        not null,
  type_inscription text        not null default 'NOUVEAU'
                   check (type_inscription in ('NOUVEAU', 'ANCIEN')),
  statut           text        not null default 'actif' check (statut in ('actif', 'inactif')),
  date_inscription date        not null default current_date,
  date_creation    timestamptz not null default now(),
  unique (id, ecole_id),
  constraint eleve_classe_ecole_fk
    foreign key (classe_id, ecole_id) references classes (id, ecole_id)
    on delete restrict
);

create index if not exists eleves_ecole_idx  on eleves (ecole_id, annee_scolaire, statut);
create index if not exists eleves_classe_idx on eleves (classe_id);
create index if not exists eleves_nom_idx    on eleves (ecole_id, nom, prenom);

-- ---------------------------------------------------------------------------
-- 5. FRAIS (la « dette » d'un élève)
--    • SCOLARITE : une ligne par échéance de la classe (10 mois, N tranches
--      ou 1 année).
--    • INSCRIPTION / REINSCRIPTION : une seule ligne, période 0.
--    • libelle : nom figé de l'échéance (« Octobre », « 1ère tranche »…).
-- ---------------------------------------------------------------------------
create table if not exists frais (
  id                 uuid primary key default gen_random_uuid(),
  ecole_id           uuid        not null references ecoles (id) on delete cascade,
  eleve_id           uuid        not null,
  annee_scolaire     text        not null,
  type_frais         text        not null default 'SCOLARITE'
                     check (type_frais in ('SCOLARITE', 'INSCRIPTION', 'REINSCRIPTION')),
  frequence_paiement text        not null default 'MENSUEL'
                     check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL')),
  periode            smallint    not null default 1 check (periode between 0 and 20),
  tranche_id         uuid,
  libelle            text,
  montant_du         integer     not null check (montant_du >= 0),
  montant_paye       integer     not null default 0 check (montant_paye >= 0),
  reste              integer     generated always as (greatest(montant_du - montant_paye, 0)) stored,
  statut             text        generated always as (
                       case
                         when montant_paye >= montant_du then 'PAYE'
                         when montant_paye > 0 then 'PARTIEL'
                         else 'NON_PAYE'
                       end
                     ) stored,
  date_creation      timestamptz not null default now(),
  unique (id, ecole_id),
  constraint frais_eleve_ecole_fk
    foreign key (eleve_id, ecole_id) references eleves (id, ecole_id)
    on delete cascade,
  constraint frais_tranche_ecole_fk
    foreign key (tranche_id, ecole_id) references tranches (id, ecole_id)
    on delete set null (tranche_id),
  constraint frais_paye_max check (montant_paye <= montant_du)
);

create index if not exists frais_eleve_idx
  on frais (eleve_id, annee_scolaire);

-- ---------------------------------------------------------------------------
-- 6. PAIEMENTS (encaissements réels, jamais supprimés : annulés)
--    periode / frequence_paiement / type_frais / libelle / tranche_id sont
--    remplis par trigger à partir de `frais`, pour conserver l'historique.
-- ---------------------------------------------------------------------------
create table if not exists paiements (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  eleve_id       uuid        not null,
  frais_id       uuid        not null,
  montant        integer     not null check (montant > 0),
  mode_paiement  text        not null check (mode_paiement in ('ESPECES', 'FLOOZ', 'TMONEY')),
  numero_recu    text        not null,
  type_frais     text        not null default 'SCOLARITE'
                 check (type_frais in ('SCOLARITE', 'INSCRIPTION', 'REINSCRIPTION')),
  frequence_paiement text    not null default 'MENSUEL'
                 check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL')),
  periode        smallint    not null default 1 check (periode between 0 and 20),
  tranche_id     uuid,
  libelle        text,
  reste_apres    integer     not null default 0,          -- reste de l'échéance juste après ce paiement
  date_paiement  timestamptz not null default now(),
  enregistre_par uuid,
  annule         boolean     not null default false,
  annule_par     uuid,
  annule_le      timestamptz,
  motif_annulation text,
  date_creation  timestamptz not null default now(),
  unique (ecole_id, numero_recu),
  constraint paiement_eleve_ecole_fk
    foreign key (eleve_id, ecole_id) references eleves (id, ecole_id) on delete cascade,
  constraint paiement_frais_ecole_fk
    foreign key (frais_id, ecole_id) references frais (id, ecole_id) on delete cascade,
  constraint paiement_user_ecole_fk
    foreign key (enregistre_par, ecole_id) references users (id, ecole_id)
    on delete set null (enregistre_par)
);

create index if not exists paiements_ecole_idx on paiements (ecole_id, date_paiement desc);
create index if not exists paiements_eleve_idx on paiements (eleve_id, date_paiement desc);
create index if not exists paiements_frais_idx on paiements (frais_id) where annule = false;

-- ---------------------------------------------------------------------------
-- 7. RÉINITIALISATION DE MOT DE PASSE
--    On ne stocke que le hachage du jeton (jamais le jeton en clair).
-- ---------------------------------------------------------------------------
create table if not exists password_resets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid        not null references users (id) on delete cascade,
  token_hash   text        not null unique,
  expire_le    timestamptz not null,
  utilise      boolean     not null default false,
  date_creation timestamptz not null default now()
);

create index if not exists password_resets_user_idx on password_resets (user_id);
create index if not exists password_resets_expire_idx on password_resets (expire_le);

-- ===========================================================================
--  MIGRATIONS IDEMPOTENTES (bases déjà créées avec le modèle « mensuel »)
-- ===========================================================================

-- Écoles : statut d'activation et fin d'abonnement ----------------------------
alter table ecoles add column if not exists statut text;
alter table ecoles add column if not exists date_fin_abonnement date;

update ecoles set statut = 'ESSAI' where statut is null;

alter table ecoles alter column statut set default 'ESSAI';
alter table ecoles alter column statut set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ecoles_statut_check') then
    alter table ecoles add constraint ecoles_statut_check
      check (statut in ('ESSAI', 'ACTIF', 'BLOQUE'));
  end if;
end $$;

create index if not exists ecoles_statut_idx on ecoles (statut);

-- Offres commerciales (STARTER / PRO / PREMIUM) ------------------------------
alter table ecoles add column if not exists offre text;

-- Reprise des anciennes formules : petite -> STARTER, moyenne -> PRO,
-- grosse -> PREMIUM. L'essai et les bases neuves démarrent en PREMIUM.
update ecoles
   set offre = case plan
     when 'petite' then 'STARTER'
     when 'moyenne' then 'PRO'
     when 'grosse' then 'PREMIUM'
     else 'PREMIUM'
   end
 where offre is null;

alter table ecoles alter column offre set default 'PREMIUM';
alter table ecoles alter column offre set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ecoles_offre_check') then
    alter table ecoles add constraint ecoles_offre_check
      check (offre in ('STARTER', 'PRO', 'PREMIUM'));
  end if;
end $$;

create index if not exists ecoles_offre_idx on ecoles (offre);

-- Rôles de l'équipe : ajout du comptable (offres PRO et PREMIUM) -------------
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('directeur', 'secretaire', 'comptable'));

-- Reçu WhatsApp structuré : nouvelle valeur par défaut pour les modèles encore
-- à l'ancien format. Les modèles personnalisés par un directeur sont conservés.
alter table ecoles alter column modele_recu set default
  E'{ecole}\nREÇU DE PAIEMENT N° {recu}\n{date}\n--------------------------------\nÉlève : {eleve}\nClasse : {classe}\nParent : {parent}\nObjet : {nature} · {periode}\nAnnée scolaire : {annee}\n--------------------------------\nMontant reçu : {montant}\nMode de paiement : {mode}\nReste à payer : {reste}\n--------------------------------\nMerci de conserver ce reçu.';

update ecoles
   set modele_recu =
     E'{ecole}\nREÇU DE PAIEMENT N° {recu}\n{date}\n--------------------------------\nÉlève : {eleve}\nClasse : {classe}\nParent : {parent}\nObjet : {nature} · {periode}\nAnnée scolaire : {annee}\n--------------------------------\nMontant reçu : {montant}\nMode de paiement : {mode}\nReste à payer : {reste}\n--------------------------------\nMerci de conserver ce reçu.'
 where modele_recu like
     'ECOLE {ecole} - Reçu : Merci M/Mme {parent}, paiement de {montant} reçu pour {eleve}, Classe {classe},%Reste à payer : {reste}. Merci.';

-- Les écoles déjà sur une formule payante gardent un accès d'un an : elles ne
-- doivent pas être bloquées par l'arrivée du système d'activation.
update ecoles
   set statut = 'ACTIF',
       date_fin_abonnement = coalesce(date_fin_abonnement, current_date + 365)
 where plan <> 'essai'
   and statut = 'ESSAI';

-- Classes : montant_mensuel -> montant_periode + nouvelles colonnes ----------
alter table classes add column if not exists montant_periode integer;
alter table classes add column if not exists frequence_paiement text;
alter table classes add column if not exists frais_inscription integer;
alter table classes add column if not exists frais_reinscription integer;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'classes'
       and column_name = 'montant_mensuel'
  ) then
    execute 'update classes set montant_periode = montant_mensuel where montant_periode is null';
    execute 'alter table classes drop column montant_mensuel';
  end if;
end $$;

update classes set montant_periode = 0 where montant_periode is null;
update classes set frequence_paiement = 'MENSUEL' where frequence_paiement is null;
update classes set frais_inscription = 0 where frais_inscription is null;
update classes set frais_reinscription = 0 where frais_reinscription is null;

alter table classes alter column montant_periode set default 0;
alter table classes alter column montant_periode set not null;
alter table classes alter column frequence_paiement set default 'MENSUEL';
alter table classes alter column frequence_paiement set not null;
alter table classes alter column frais_inscription set default 0;
alter table classes alter column frais_inscription set not null;
alter table classes alter column frais_reinscription set default 0;
alter table classes alter column frais_reinscription set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'classes_frequence_check') then
    alter table classes add constraint classes_frequence_check
      check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'classes_montant_periode_check') then
    alter table classes add constraint classes_montant_periode_check
      check (montant_periode >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'classes_inscription_check') then
    alter table classes add constraint classes_inscription_check
      check (frais_inscription >= 0 and frais_reinscription >= 0);
  end if;
end $$;

-- Tranches libres ------------------------------------------------------------
-- Colonnes de rattachement sur les échéances et les encaissements.
alter table frais add column if not exists tranche_id uuid;
alter table frais add column if not exists libelle text;
alter table paiements add column if not exists tranche_id uuid;
alter table paiements add column if not exists libelle text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'frais_tranche_ecole_fk') then
    alter table frais add constraint frais_tranche_ecole_fk
      foreign key (tranche_id, ecole_id) references tranches (id, ecole_id)
      on delete set null (tranche_id);
  end if;
end $$;

-- Anciennes classes « trimestrielles » : on fabrique 3 tranches égales (les
-- montants restent identiques aux trimestres déjà facturés), puis on bascule
-- sur le modèle de tranches libres. Le directeur pourra ensuite modifier les
-- noms, montants et dates.
insert into tranches (ecole_id, classe_id, ordre, nom, montant)
select c.ecole_id, c.id, n::smallint, 'Tranche ' || n, c.montant_periode
  from classes c
  cross join generate_series(1, 3) as n
 where c.frequence_paiement = 'TRIMESTRIEL'
   and not exists (select 1 from tranches t where t.classe_id = c.id)
on conflict (classe_id, ordre) do nothing;

-- Les anciennes contraintes n'acceptaient pas TRANCHES : on les remplace
-- avant de convertir les données.
alter table classes drop constraint if exists classes_frequence_check;
alter table frais drop constraint if exists frais_frequence_check;
alter table frais drop constraint if exists frais_periode_coherente;
alter table paiements drop constraint if exists paiements_frequence_check;
alter table paiements drop constraint if exists paiements_periode_check;

-- Les triggers applicatifs sont recréés plus bas avec le modèle « tranches ».
-- On les retire le temps de la conversion pour éviter d'appeler une ancienne
-- version de la fonction pendant la mise à jour.
drop trigger if exists classes_ajuster_frais on classes;
drop trigger if exists tranches_ajuster_frais on tranches;

update classes set frequence_paiement = 'TRANCHES'
 where frequence_paiement = 'TRIMESTRIEL';
update frais set frequence_paiement = 'TRANCHES'
 where frequence_paiement = 'TRIMESTRIEL';
update paiements set frequence_paiement = 'TRANCHES'
 where frequence_paiement = 'TRIMESTRIEL';

-- Libellé figé de chaque échéance existante.
update frais
   set libelle = case
     when type_frais = 'INSCRIPTION' then 'Frais d''inscription'
     when type_frais = 'REINSCRIPTION' then 'Frais de réinscription'
     when frequence_paiement = 'MENSUEL' then
       (array['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier',
              'Février', 'Mars', 'Avril', 'Mai', 'Juin'])
       [greatest(1, least(10, periode))]
     when frequence_paiement = 'ANNUEL' then 'Année ' || annee_scolaire
     else coalesce(
       (select t.nom from tranches t where t.id = frais.tranche_id),
       'Tranche ' || periode
     )
   end
 where libelle is null;

update paiements p
   set libelle = f.libelle,
       tranche_id = coalesce(p.tranche_id, f.tranche_id)
  from frais f
 where f.id = p.frais_id
   and (p.libelle is null or p.tranche_id is null);

-- Élèves : type_inscription ------------------------------------------------
alter table eleves add column if not exists type_inscription text;
update eleves set type_inscription = 'NOUVEAU' where type_inscription is null;
alter table eleves alter column type_inscription set default 'NOUVEAU';
alter table eleves alter column type_inscription set not null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'eleves_type_inscription_check') then
    alter table eleves add constraint eleves_type_inscription_check
      check (type_inscription in ('NOUVEAU', 'ANCIEN'));
  end if;
end $$;

-- Frais : mois -> type_frais / frequence_paiement / periode -----------------
alter table frais add column if not exists type_frais text;
alter table frais add column if not exists frequence_paiement text;
alter table frais add column if not exists periode smallint;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'frais'
       and column_name = 'mois'
  ) then
    execute 'update frais set periode = mois where periode is null';
  end if;
end $$;

update frais set type_frais = 'SCOLARITE' where type_frais is null;
update frais set frequence_paiement = 'MENSUEL' where frequence_paiement is null;
update frais set periode = 1 where periode is null;

-- Ancienne contrainte d'unicité (élève, année, mois) et anciens index.
do $$
declare
  v_nom text;
begin
  for v_nom in
    select conname from pg_constraint
     where conrelid = 'public.frais'::regclass
       and contype = 'u'
       and pg_get_constraintdef(oid) like '%(eleve_id, annee_scolaire, mois)%'
  loop
    execute format('alter table frais drop constraint %I', v_nom);
  end loop;
end $$;

drop index if exists frais_ecole_mois_idx;
drop index if exists frais_eleve_mois_idx;

do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'frais'
       and column_name = 'mois'
  ) then
    execute 'alter table frais drop column mois';
  end if;
end $$;

alter table frais alter column type_frais set default 'SCOLARITE';
alter table frais alter column type_frais set not null;
alter table frais alter column frequence_paiement set default 'MENSUEL';
alter table frais alter column frequence_paiement set not null;
alter table frais alter column periode set default 1;
alter table frais alter column periode set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'frais_type_check') then
    alter table frais add constraint frais_type_check
      check (type_frais in ('SCOLARITE', 'INSCRIPTION', 'REINSCRIPTION'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'frais_frequence_check') then
    alter table frais add constraint frais_frequence_check
      check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'frais_periode_coherente') then
    alter table frais add constraint frais_periode_coherente check (
      (type_frais = 'SCOLARITE' and (
        (frequence_paiement = 'MENSUEL' and periode between 1 and 10)
        or (frequence_paiement = 'TRANCHES' and periode between 1 and 20)
        or (frequence_paiement = 'ANNUEL' and periode = 1)
      ))
      or (type_frais in ('INSCRIPTION', 'REINSCRIPTION') and periode = 0)
    );
  end if;
  if not exists (select 1 from pg_constraint where conname = 'frais_echeance_unique') then
    alter table frais add constraint frais_echeance_unique
      unique (eleve_id, annee_scolaire, type_frais, periode);
  end if;
end $$;

-- Index créés après les migrations (les anciennes bases n'avaient pas encore
-- les colonnes frequence_paiement / type_frais / periode).
create index if not exists frais_ecole_periode_idx
  on frais (ecole_id, annee_scolaire, frequence_paiement, periode);
create index if not exists frais_type_idx
  on frais (eleve_id, annee_scolaire, type_frais, periode);
create index if not exists frais_statut_idx
  on frais (ecole_id, annee_scolaire, frequence_paiement, periode, statut);

-- Paiements : instantané de la nature et de la période ----------------------
alter table paiements add column if not exists type_frais text;
alter table paiements add column if not exists frequence_paiement text;
alter table paiements add column if not exists periode smallint;

update paiements p
   set type_frais = coalesce(p.type_frais, f.type_frais),
       frequence_paiement = coalesce(p.frequence_paiement, f.frequence_paiement),
       periode = coalesce(p.periode, f.periode)
  from frais f
 where f.id = p.frais_id
   and (p.type_frais is null or p.frequence_paiement is null or p.periode is null);

update paiements set type_frais = 'SCOLARITE' where type_frais is null;
update paiements set frequence_paiement = 'MENSUEL' where frequence_paiement is null;
update paiements set periode = 1 where periode is null;

alter table paiements alter column type_frais set default 'SCOLARITE';
alter table paiements alter column type_frais set not null;
alter table paiements alter column frequence_paiement set default 'MENSUEL';
alter table paiements alter column frequence_paiement set not null;
alter table paiements alter column periode set default 1;
alter table paiements alter column periode set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'paiements_type_check') then
    alter table paiements add constraint paiements_type_check
      check (type_frais in ('SCOLARITE', 'INSCRIPTION', 'REINSCRIPTION'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'paiements_frequence_check') then
    alter table paiements add constraint paiements_frequence_check
      check (frequence_paiement in ('MENSUEL', 'TRANCHES', 'ANNUEL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'paiements_periode_check') then
    alter table paiements add constraint paiements_periode_check
      check (periode between 0 and 20);
  end if;
end $$;

create index if not exists paiements_periode_idx
  on paiements (ecole_id, frequence_paiement, periode, type_frais);

-- Modèles WhatsApp : {mois} devient {periode} (les deux restent acceptés).
update ecoles
   set modele_recu = replace(modele_recu, '{mois}', '{periode}'),
       modele_relance = replace(modele_relance, '{mois}', '{periode}')
 where modele_recu like '%{mois}%' or modele_relance like '%{mois}%';

-- Backfill : les élèves créés avant cette version n'ont pas de ligne
-- d'inscription / réinscription. On la crée avec le tarif actuel de la classe.
insert into frais
  (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
   periode, libelle, montant_du)
select e.ecole_id,
       e.id,
       e.annee_scolaire,
       case when e.type_inscription = 'ANCIEN'
            then 'REINSCRIPTION' else 'INSCRIPTION' end,
       c.frequence_paiement,
       0,
       case when e.type_inscription = 'ANCIEN'
            then 'Frais de réinscription' else 'Frais d''inscription' end,
       greatest(
         case when e.type_inscription = 'ANCIEN'
              then c.frais_reinscription else c.frais_inscription end,
         0
       )
  from eleves e
  join classes c on c.id = e.classe_id
 where not exists (
   select 1 from frais f
    where f.eleve_id = e.id
      and f.annee_scolaire = e.annee_scolaire
      and f.type_frais in ('INSCRIPTION', 'REINSCRIPTION')
 )
on conflict (eleve_id, annee_scolaire, type_frais, periode) do nothing;

-- ===========================================================================
--  FONCTIONS ET TRIGGERS
-- ===========================================================================

-- Horodatage de modification -------------------------------------------------
create or replace function maj_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists ecoles_updated_at on ecoles;
create trigger ecoles_updated_at
  before update on ecoles
  for each row execute function maj_updated_at();

-- Nombre de périodes d'une fréquence fixe --------------------------------
-- (les classes en tranches se lisent dans la table `tranches`)
create or replace function nombre_periodes(p_frequence text) returns integer
language sql immutable as $$
  select case p_frequence
    when 'ANNUEL' then 1
    when 'TRANCHES' then 0
    else 10
  end;
$$;

-- Libellé par défaut d'une échéance de scolarité --------------------------
create or replace function libelle_scolarite(
  p_frequence text,
  p_periode smallint,
  p_annee text
) returns text
language sql immutable as $$
  select case
    when p_frequence = 'MENSUEL' then
      (array['Septembre', 'Octobre', 'Novembre', 'Décembre', 'Janvier',
             'Février', 'Mars', 'Avril', 'Mai', 'Juin'])
      [greatest(1, least(10, p_periode))]
    when p_frequence = 'ANNUEL' then 'Année ' || p_annee
    else 'Tranche ' || p_periode
  end;
$$;

-- Recalcule les échéances d'un élève selon sa classe -----------------------
create or replace function ajuster_frais_eleve(p_eleve_id uuid) returns void
language plpgsql as $$
declare
  v_eleve   record;
  v_classe  record;
  v_nb      integer;
  v_special integer;
  v_type    text;
begin
  select e.id, e.ecole_id, e.classe_id, e.annee_scolaire, e.type_inscription
    into v_eleve
    from eleves e
   where e.id = p_eleve_id;
  if not found then
    return;
  end if;

  select c.montant_periode, c.frequence_paiement,
         c.frais_inscription, c.frais_reinscription
    into v_classe
    from classes c
   where c.id = v_eleve.classe_id;
  if not found then
    return;
  end if;

  if v_classe.frequence_paiement = 'TRANCHES' then
    -- Une ligne par tranche de la classe. Les montants des échéances déjà
    -- entamées ne bougent pas ; seules les lignes non payées suivent le tarif.
    insert into frais
      (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
       periode, tranche_id, libelle, montant_du)
    select v_eleve.ecole_id, v_eleve.id, v_eleve.annee_scolaire,
           'SCOLARITE', 'TRANCHES', t.ordre, t.id, t.nom, t.montant
      from tranches t
     where t.classe_id = v_eleve.classe_id
    on conflict (eleve_id, annee_scolaire, type_frais, periode) do update
      set montant_du = excluded.montant_du,
          tranche_id = excluded.tranche_id,
          libelle = excluded.libelle,
          frequence_paiement = excluded.frequence_paiement
      where frais.montant_paye = 0;

    -- Tranches supprimées par l'école : on retire les lignes encore vierges.
    delete from frais f
     where f.eleve_id = v_eleve.id
       and f.annee_scolaire = v_eleve.annee_scolaire
       and f.type_frais = 'SCOLARITE'
       and f.montant_paye = 0
       and exists (select 1 from tranches t where t.classe_id = v_eleve.classe_id)
       and not exists (
         select 1 from tranches t
          where t.classe_id = v_eleve.classe_id
            and t.ordre = f.periode
       );
  else
    v_nb := nombre_periodes(v_classe.frequence_paiement);

    -- Si aucune scolarité n'a encore été payée, on régénère proprement les
    -- périodes (utile quand la fréquence de la classe change).
    if exists (
      select 1 from frais
       where eleve_id = v_eleve.id
         and annee_scolaire = v_eleve.annee_scolaire
         and type_frais = 'SCOLARITE'
         and montant_paye > 0
    ) then
      update frais
         set montant_du = v_classe.montant_periode
       where eleve_id = v_eleve.id
         and annee_scolaire = v_eleve.annee_scolaire
         and type_frais = 'SCOLARITE'
         and montant_paye = 0;
    else
      delete from frais
       where eleve_id = v_eleve.id
         and annee_scolaire = v_eleve.annee_scolaire
         and type_frais = 'SCOLARITE'
         and montant_paye = 0;

      insert into frais
        (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
         periode, tranche_id, libelle, montant_du)
      select v_eleve.ecole_id, v_eleve.id, v_eleve.annee_scolaire,
             'SCOLARITE', v_classe.frequence_paiement, p, null,
             libelle_scolarite(v_classe.frequence_paiement, p::smallint,
                               v_eleve.annee_scolaire),
             v_classe.montant_periode
        from generate_series(1, v_nb) as p
      on conflict (eleve_id, annee_scolaire, type_frais, periode) do update
        set montant_du = excluded.montant_du,
            frequence_paiement = excluded.frequence_paiement,
            libelle = excluded.libelle,
            tranche_id = null
        where frais.montant_paye = 0;
    end if;
  end if;

  v_special := case
    when v_eleve.type_inscription = 'ANCIEN' then v_classe.frais_reinscription
    else v_classe.frais_inscription
  end;
  v_type := case
    when v_eleve.type_inscription = 'ANCIEN' then 'REINSCRIPTION'
    else 'INSCRIPTION'
  end;

  -- Si le type d'inscription a changé, on retire l'ancienne ligne spéciale
  -- encore impayée (jamais une ligne déjà entamée).
  delete from frais
   where eleve_id = v_eleve.id
     and annee_scolaire = v_eleve.annee_scolaire
     and type_frais in ('INSCRIPTION', 'REINSCRIPTION')
     and type_frais <> v_type
     and montant_paye = 0;

  update frais
     set montant_du = coalesce(v_special, 0),
         libelle = case when v_type = 'INSCRIPTION'
                        then 'Frais d''inscription'
                        else 'Frais de réinscription' end
   where eleve_id = v_eleve.id
     and annee_scolaire = v_eleve.annee_scolaire
     and type_frais = v_type
     and montant_paye = 0;

  insert into frais
    (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
     periode, libelle, montant_du)
  values
    (v_eleve.ecole_id, v_eleve.id, v_eleve.annee_scolaire, v_type,
     v_classe.frequence_paiement, 0,
     case when v_type = 'INSCRIPTION'
          then 'Frais d''inscription'
          else 'Frais de réinscription' end,
     coalesce(v_special, 0))
  on conflict (eleve_id, annee_scolaire, type_frais, periode) do nothing;
end $$;

-- Création automatique des échéances à l'inscription d'un élève --------------
create or replace function creer_frais_eleve() returns trigger
language plpgsql as $$
declare
  v_classe   record;
  v_nb       integer;
  v_type     text;
  v_montant  integer;
begin
  select c.montant_periode, c.frequence_paiement,
         c.frais_inscription, c.frais_reinscription
    into v_classe
    from classes c
   where c.id = new.classe_id;
  if not found then
    return new;
  end if;

  if v_classe.frequence_paiement = 'TRANCHES' then
    insert into frais
      (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
       periode, tranche_id, libelle, montant_du)
    select new.ecole_id, new.id, new.annee_scolaire,
           'SCOLARITE', 'TRANCHES', t.ordre, t.id, t.nom, t.montant
      from tranches t
     where t.classe_id = new.classe_id
    on conflict (eleve_id, annee_scolaire, type_frais, periode) do nothing;
  else
    v_nb := nombre_periodes(v_classe.frequence_paiement);

    insert into frais
      (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
       periode, libelle, montant_du)
    select new.ecole_id, new.id, new.annee_scolaire,
           'SCOLARITE', v_classe.frequence_paiement, p,
           libelle_scolarite(v_classe.frequence_paiement, p::smallint,
                             new.annee_scolaire),
           v_classe.montant_periode
      from generate_series(1, v_nb) as p
    on conflict (eleve_id, annee_scolaire, type_frais, periode) do nothing;
  end if;

  v_type := case when new.type_inscription = 'ANCIEN'
                 then 'REINSCRIPTION' else 'INSCRIPTION' end;
  v_montant := case when v_type = 'REINSCRIPTION'
                    then v_classe.frais_reinscription
                    else v_classe.frais_inscription end;

  insert into frais
    (ecole_id, eleve_id, annee_scolaire, type_frais, frequence_paiement,
     periode, libelle, montant_du)
  values
    (new.ecole_id, new.id, new.annee_scolaire, v_type,
     v_classe.frequence_paiement, 0,
     case when v_type = 'INSCRIPTION'
          then 'Frais d''inscription'
          else 'Frais de réinscription' end,
     coalesce(v_montant, 0))
  on conflict (eleve_id, annee_scolaire, type_frais, periode) do nothing;

  return new;
end $$;

drop trigger if exists eleves_creer_frais on eleves;
create trigger eleves_creer_frais
  after insert on eleves
  for each row execute function creer_frais_eleve();

-- Changement de classe ou de type d'inscription ------------------------------
create or replace function changer_classe_eleve() returns trigger
language plpgsql as $$
begin
  if new.classe_id is distinct from old.classe_id
     or new.type_inscription is distinct from old.type_inscription then
    perform ajuster_frais_eleve(new.id);
  end if;
  return new;
end $$;

drop trigger if exists eleves_changer_classe on eleves;
create trigger eleves_changer_classe
  after update of classe_id, type_inscription on eleves
  for each row execute function changer_classe_eleve();

-- Modification d'une classe : on réajuste les échéances non payées -----------
create or replace function ajuster_frais_classe() returns trigger
language plpgsql as $$
declare
  v_eleve uuid;
begin
  if new.montant_periode is distinct from old.montant_periode
     or new.frequence_paiement is distinct from old.frequence_paiement
     or new.frais_inscription is distinct from old.frais_inscription
     or new.frais_reinscription is distinct from old.frais_reinscription then
    for v_eleve in
      select id from eleves where classe_id = new.id
    loop
      perform ajuster_frais_eleve(v_eleve);
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists classes_ajuster_frais on classes;
create trigger classes_ajuster_frais
  after update of montant_periode, frequence_paiement,
                   frais_inscription, frais_reinscription on classes
  for each row execute function ajuster_frais_classe();

-- Modification d'une tranche : les échéances des élèves suivent -------------
create or replace function ajuster_frais_tranche() returns trigger
language plpgsql as $$
declare
  v_classe uuid;
  v_eleve  uuid;
begin
  v_classe := coalesce(new.classe_id, old.classe_id);
  for v_eleve in select id from eleves where classe_id = v_classe loop
    perform ajuster_frais_eleve(v_eleve);
  end loop;
  return null;
end $$;

drop trigger if exists tranches_ajuster_frais on tranches;
create trigger tranches_ajuster_frais
  after insert or update or delete on tranches
  for each row execute function ajuster_frais_tranche();

-- Recalcul du montant payé d'une échéance à partir des paiements valides -----
create or replace function recalculer_frais(p_frais_id uuid) returns void
language plpgsql as $$
declare
  v_total integer;
  v_du    integer;
begin
  select montant_du into v_du from frais where id = p_frais_id for update;
  if not found then
    return;
  end if;

  select coalesce(sum(montant), 0)
    into v_total
    from paiements
   where frais_id = p_frais_id
     and annule = false;

  if v_total > v_du then
    raise exception 'MONTANT_DEPASSE: le total payé (%) dépasse le montant dû (%).', v_total, v_du
      using errcode = 'P0001';
  end if;

  update frais set montant_paye = v_total where id = p_frais_id;
end $$;

create or replace function trigger_recalculer_frais() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recalculer_frais(old.frais_id);
    return old;
  end if;

  perform recalculer_frais(new.frais_id);
  -- Rare : déplacement d'un paiement d'une échéance à une autre.
  if tg_op = 'UPDATE' and old.frais_id is distinct from new.frais_id then
    perform recalculer_frais(old.frais_id);
  end if;
  return new;
end $$;

-- (PostgreSQL n'autorise pas UPDATE OF avec plusieurs événements : 2 triggers.)
drop trigger if exists paiements_recalcul_insert on paiements;
create trigger paiements_recalcul_insert
  after insert or delete on paiements
  for each row execute function trigger_recalculer_frais();

drop trigger if exists paiements_recalcul_update on paiements;
create trigger paiements_recalcul_update
  after update of montant, annule, frais_id on paiements
  for each row execute function trigger_recalculer_frais();

-- Instantané de la nature, de l'échéance et de la tranche au moment du
-- paiement ------------------------------------------------------------------
create or replace function remplir_snapshot_paiement() returns trigger
language plpgsql as $$
declare
  v_type  text;
  v_freq  text;
  v_periode smallint;
  v_libelle text;
  v_tranche uuid;
begin
  select type_frais, frequence_paiement, periode, libelle, tranche_id
    into v_type, v_freq, v_periode, v_libelle, v_tranche
    from frais
   where id = new.frais_id;

  if not found then
    raise exception 'FRAIS_INTROUVABLE';
  end if;

  new.type_frais := v_type;
  new.frequence_paiement := v_freq;
  new.periode := v_periode;
  new.libelle := v_libelle;
  new.tranche_id := v_tranche;
  return new;
end $$;

drop trigger if exists paiements_snapshot on paiements;
create trigger paiements_snapshot
  before insert or update of frais_id on paiements
  for each row execute function remplir_snapshot_paiement();

-- Un paiement ne peut jamais dépasser le reste dû (verrou anti-concurrence) --
create or replace function verifier_paiement() returns trigger
language plpgsql as $$
declare
  v_du    integer;
  v_paye  integer;
begin
  if new.annule then
    return new;
  end if;

  select montant_du into v_du from frais where id = new.frais_id for update;
  if not found then
    raise exception 'FRAIS_INTROUVABLE';
  end if;

  select coalesce(sum(montant), 0) into v_paye
    from paiements
   where frais_id = new.frais_id
     and annule = false
     and id is distinct from new.id;

  if v_paye + new.montant > v_du then
    raise exception 'MONTANT_DEPASSE: reste dû % F, montant demandé % F.',
      v_du - v_paye, new.montant
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists paiements_verifier on paiements;
create trigger paiements_verifier
  before insert or update of montant, annule, frais_id on paiements
  for each row execute function verifier_paiement();

-- ---------------------------------------------------------------------------
-- Compléments idempotents (colonnes ajoutées après la première version)
-- ---------------------------------------------------------------------------
alter table users add column if not exists token_version integer not null default 0;
alter table paiements add column if not exists reste_apres integer not null default 0;

-- ===========================================================================
--  ANTI-TRICHE DES ESSAIS + ANTI-BRUTE-FORCE
-- ===========================================================================

-- Normalisation des noms d'école : minuscules, accents retirés, espaces et
-- ponctuation supprimés. La même règle est appliquée en TypeScript.
create or replace function normaliser_nom_ecole(valeur text)
returns text
language sql
immutable
as $$
  select regexp_replace(
    translate(
      replace(replace(lower(coalesce(valeur, '')), 'œ', 'oe'), 'æ', 'ae'),
      'àâäáãåçéèêëíìîïóòôöõúùûüýÿñ',
      'aaaaaaceeeeiiiiooooouuuuyyn'
    ),
    '[^a-z0-9]', '', 'g'
  );
$$;

-- Identité de l'école au moment de l'inscription -----------------------------
alter table ecoles add column if not exists nom_normalise text;
alter table ecoles add column if not exists telephone_normalise text;
alter table ecoles add column if not exists whatsapp text;
alter table ecoles add column if not exists whatsapp_normalise text;
alter table ecoles add column if not exists ip_inscription text;
alter table ecoles add column if not exists appareil_inscription text;

update ecoles
   set nom_normalise = normaliser_nom_ecole(nom)
 where nom_normalise is null;

update ecoles
   set telephone_normalise = nullif(
     right(regexp_replace(coalesce(telephone, ''), '[^0-9]', '', 'g'), 8),
     ''
   )
 where telephone_normalise is null;

update ecoles set whatsapp = telephone where whatsapp is null;

update ecoles
   set whatsapp_normalise = nullif(
     right(regexp_replace(coalesce(whatsapp, ''), '[^0-9]', '', 'g'), 8),
     ''
   )
 where whatsapp_normalise is null;

-- Registre des essais réellement accordés ------------------------------------
-- Une ligne active = l'essai gratuit a déjà été consommé pour cette identité.
-- Le passage à actif = false (bouton FORCER du super admin) autorise un nouvel
-- essai sans jamais supprimer l'historique.
create table if not exists essais_utilises (
  id                  uuid primary key default gen_random_uuid(),
  ecole_id            uuid references ecoles (id) on delete set null,
  nom_ecole           text        not null,
  nom_normalise       text        not null,
  telephone           text,
  telephone_normalise text,
  whatsapp            text,
  whatsapp_normalise  text,
  email               text        not null,
  ip                  text,
  appareil            text,
  actif               boolean     not null default true,
  date_creation       timestamptz not null default now()
);

create index if not exists essais_utilises_date_idx
  on essais_utilises (date_creation desc);

create unique index if not exists essais_utilises_nom_unique
  on essais_utilises (nom_normalise) where actif;
create unique index if not exists essais_utilises_tel_unique
  on essais_utilises (telephone_normalise)
  where actif and telephone_normalise is not null;
create unique index if not exists essais_utilises_whatsapp_unique
  on essais_utilises (whatsapp_normalise)
  where actif and whatsapp_normalise is not null;

-- Reprise des écoles existantes : elles ont déjà consommé leur essai.
insert into essais_utilises
  (ecole_id, nom_ecole, nom_normalise, telephone, telephone_normalise,
   whatsapp, whatsapp_normalise, email, ip, appareil, actif)
select e.id,
       e.nom,
       coalesce(e.nom_normalise, normaliser_nom_ecole(e.nom)),
       e.telephone,
       e.telephone_normalise,
       coalesce(e.whatsapp, e.telephone),
       coalesce(e.whatsapp_normalise, e.telephone_normalise),
       e.email,
       e.ip_inscription,
       e.appareil_inscription,
       true
  from ecoles e
 where not exists (
   select 1 from essais_utilises t where t.ecole_id = e.id
 )
on conflict do nothing;

-- Journal d'audit des inscriptions refusées / forcées ------------------------
create table if not exists inscriptions_audit (
  id                  uuid primary key default gen_random_uuid(),
  type                text        not null default 'REFUS'
                      check (type in ('REFUS', 'FORCE')),
  nom_ecole           text        not null,
  nom_normalise       text        not null,
  telephone           text,
  telephone_normalise text,
  whatsapp            text,
  whatsapp_normalise  text,
  email               text        not null,
  ip                  text,
  appareil            text,
  motif               text,
  essai_id            uuid references essais_utilises (id) on delete set null,
  auteur              text,
  traite              boolean     not null default false,
  date_creation       timestamptz not null default now()
);

create index if not exists inscriptions_audit_date_idx
  on inscriptions_audit (date_creation desc);
create index if not exists inscriptions_audit_type_idx
  on inscriptions_audit (type, traite);

-- Journal des tentatives de connexion ---------------------------------------
create table if not exists login_attempts (
  id             uuid primary key default gen_random_uuid(),
  email          text        not null,
  ip             text,
  appareil       text,
  succes         boolean     not null,
  bloque         boolean     not null default false,
  date_creation  timestamptz not null default now()
);

create index if not exists login_attempts_email_idx
  on login_attempts (email, date_creation desc);
create index if not exists login_attempts_ip_idx
  on login_attempts (ip, date_creation desc);

-- Rate limiting générique côté serveur (fenêtres fixes) ---------------------
create table if not exists rate_limits (
  cle            text        not null,
  fenetre        timestamptz not null,
  compteur       integer     not null default 0,
  primary key (cle, fenetre)
);

create index if not exists rate_limits_fenetre_idx on rate_limits (fenetre);

-- Double authentification du super admin ------------------------------------
-- Le secret TOTP est stocké en base pour être activable depuis l'application.
-- Les codes de secours sont hachés (bcrypt) : ils ne sont affichés qu'une fois.
create table if not exists super_admin_2fa (
  email             text        primary key,
  secret            text        not null,
  actif             boolean     not null default true,
  codes_secours     jsonb       not null default '[]'::jsonb,
  dernier_compteur  bigint      not null default 0,
  active_le         timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- Journal d'audit des actions sensibles --------------------------------------
-- Aucune donnée de paiement ni mot de passe : seulement l'action, son auteur,
-- la cible et un contexte lisible.
create table if not exists journal_actions (
  id             uuid        primary key default gen_random_uuid(),
  action         text        not null,
  libelle        text        not null,
  auteur         text        not null default 'système',
  cible          text,
  cible_id       uuid,
  ip             text,
  details        jsonb       not null default '{}'::jsonb,
  date_creation  timestamptz not null default now()
);

create index if not exists journal_actions_date_idx
  on journal_actions (date_creation desc);
create index if not exists journal_actions_action_idx
  on journal_actions (action, date_creation desc);

-- Déconnexion automatique après 24 h d'inactivité ---------------------------
alter table users add column if not exists derniere_activite timestamptz;

update users
   set derniere_activite = coalesce(derniere_connexion, date_creation, now())
 where derniere_activite is null;

alter table users alter column derniere_activite set default now();
alter table users alter column derniere_activite set not null;

-- ===========================================================================
--  MODULES PREMIUM : NOTES & BULLETINS
-- ===========================================================================

-- Matières enseignées, propres à l'école. Le coefficient pondère la moyenne.
create table if not exists matieres (
  id            uuid primary key default gen_random_uuid(),
  ecole_id      uuid        not null references ecoles (id) on delete cascade,
  nom           text        not null,
  coefficient   smallint    not null default 1 check (coefficient between 1 and 20),
  ordre         integer     not null default 0,
  date_creation timestamptz not null default now(),
  unique (id, ecole_id),
  unique (ecole_id, nom)
);

create index if not exists matieres_ecole_idx
  on matieres (ecole_id, ordre, nom);

-- Une note par élève, par matière, par année scolaire et par trimestre.
-- La moyenne du bulletin est calculée à partir de ces lignes et des coefficients.
create table if not exists notes (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  eleve_id       uuid        not null,
  matiere_id     uuid        not null,
  annee_scolaire text        not null,
  trimestre      smallint    not null check (trimestre between 1 and 3),
  note           numeric(4,2) not null check (note >= 0 and note <= 20),
  appreciation   text,
  date_creation  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (eleve_id, matiere_id, annee_scolaire, trimestre),
  constraint note_eleve_ecole_fk
    foreign key (eleve_id, ecole_id) references eleves (id, ecole_id)
    on delete cascade,
  constraint note_matiere_ecole_fk
    foreign key (matiere_id, ecole_id) references matieres (id, ecole_id)
    on delete cascade
);

create index if not exists notes_grille_idx
  on notes (ecole_id, annee_scolaire, trimestre, eleve_id);
create index if not exists notes_matiere_idx on notes (matiere_id);

drop trigger if exists notes_updated_at on notes;
create trigger notes_updated_at
  before update on notes
  for each row execute function maj_updated_at();

-- ===========================================================================
--  MODULES PREMIUM : PROFS & SALAIRES
-- ===========================================================================

create table if not exists profs (
  id               uuid primary key default gen_random_uuid(),
  ecole_id         uuid        not null references ecoles (id) on delete cascade,
  nom              text        not null,
  prenom           text        not null,
  telephone        text,
  email            text,
  matiere          text,
  classes_assurees text,
  salaire_mensuel  integer     not null default 0 check (salaire_mensuel >= 0),
  date_embauche    date,
  actif            boolean     not null default true,
  notes            text,
  date_creation    timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, ecole_id)
);

create index if not exists profs_ecole_idx
  on profs (ecole_id, actif, nom, prenom);

drop trigger if exists profs_updated_at on profs;
create trigger profs_updated_at
  before update on profs
  for each row execute function maj_updated_at();

-- Salaire dû pour un professeur et un mois calendaire. Les versements
-- (acomptes ou solde) sont conservés séparément dans versements_salaires.
create table if not exists salaires (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  prof_id        uuid        not null,
  annee          integer     not null check (annee between 2000 and 2100),
  mois           smallint    not null check (mois between 1 and 12),
  montant_du     integer     not null default 0 check (montant_du >= 0),
  montant_paye   integer     not null default 0 check (montant_paye >= 0),
  reste          integer     generated always as (greatest(montant_du - montant_paye, 0)) stored,
  statut         text        generated always as (
                   case
                     when montant_paye >= montant_du then 'PAYE'
                     when montant_paye > 0 then 'PARTIEL'
                     else 'NON_PAYE'
                   end
                 ) stored,
  observation    text,
  date_creation  timestamptz not null default now(),
  unique (id, ecole_id),
  unique (prof_id, annee, mois),
  constraint salaire_prof_ecole_fk
    foreign key (prof_id, ecole_id) references profs (id, ecole_id)
    on delete cascade,
  constraint salaire_paye_max check (montant_paye <= montant_du)
);

create index if not exists salaires_mois_idx
  on salaires (ecole_id, annee, mois, statut);
create index if not exists salaires_prof_idx
  on salaires (prof_id, annee desc, mois desc);

create table if not exists versements_salaires (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  salaire_id     uuid        not null,
  montant        integer     not null check (montant > 0),
  mode_paiement  text        not null default 'ESPECES'
                 check (mode_paiement in ('ESPECES', 'FLOOZ', 'TMONEY')),
  date_versement date        not null default current_date,
  observation    text,
  enregistre_par uuid,
  date_creation  timestamptz not null default now(),
  unique (id, ecole_id),
  constraint versement_salaire_fk
    foreign key (salaire_id, ecole_id) references salaires (id, ecole_id)
    on delete cascade,
  constraint versement_salaire_user_fk
    foreign key (enregistre_par, ecole_id) references users (id, ecole_id)
    on delete set null (enregistre_par)
);

create index if not exists versements_salaires_idx
  on versements_salaires (ecole_id, date_versement desc);
create index if not exists versements_salaires_salaire_idx
  on versements_salaires (salaire_id);

-- Recalcul du montant payé d'un salaire à partir des versements valides.
-- Le verrou `for update` empêche deux versements simultanés de dépasser le dû.
create or replace function recalculer_salaire(p_salaire_id uuid) returns void
language plpgsql as $$
declare
  v_total integer;
  v_du    integer;
begin
  select montant_du into v_du from salaires where id = p_salaire_id for update;
  if not found then
    return;
  end if;

  select coalesce(sum(montant), 0)::int
    into v_total
    from versements_salaires
   where salaire_id = p_salaire_id;

  if v_total > v_du then
    raise exception 'SALAIRE_DEPASSE: le total versé (%) dépasse le salaire dû (%).',
      v_total, v_du
      using errcode = 'P0001';
  end if;

  update salaires set montant_paye = v_total where id = p_salaire_id;
end $$;

create or replace function trigger_recalculer_salaire() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform recalculer_salaire(old.salaire_id);
    return old;
  end if;

  perform recalculer_salaire(new.salaire_id);
  if tg_op = 'UPDATE' and old.salaire_id is distinct from new.salaire_id then
    perform recalculer_salaire(old.salaire_id);
  end if;
  return new;
end $$;

drop trigger if exists versements_salaires_recalcul_insert on versements_salaires;
create trigger versements_salaires_recalcul_insert
  after insert or delete on versements_salaires
  for each row execute function trigger_recalculer_salaire();

drop trigger if exists versements_salaires_recalcul_update on versements_salaires;
create trigger versements_salaires_recalcul_update
  after update of montant, salaire_id on versements_salaires
  for each row execute function trigger_recalculer_salaire();

-- Un versement ne peut jamais dépasser le reste du salaire.
create or replace function verifier_versement_salaire() returns trigger
language plpgsql as $$
declare
  v_du    integer;
  v_paye  integer;
begin
  select montant_du into v_du from salaires where id = new.salaire_id for update;
  if not found then
    raise exception 'SALAIRE_INTROUVABLE';
  end if;

  select coalesce(sum(montant), 0)::int into v_paye
    from versements_salaires
   where salaire_id = new.salaire_id
     and id is distinct from new.id;

  if v_paye + new.montant > v_du then
    raise exception 'SALAIRE_DEPASSE: reste à verser % F, montant demandé % F.',
      v_du - v_paye, new.montant
      using errcode = 'P0001';
  end if;

  return new;
end $$;

drop trigger if exists versements_salaires_verifier on versements_salaires;
create trigger versements_salaires_verifier
  before insert or update of montant, salaire_id on versements_salaires
  for each row execute function verifier_versement_salaire();

-- ===========================================================================
--  PORTAIL PARENT PUBLIC
--  Un lien unique par école : /parent/nom-de-lecole
-- ===========================================================================

-- Normalisation pour la recherche par nom : minuscules, sans accents.
create or replace function normaliser_texte(valeur text)
returns text
language sql
immutable
as $$
  select translate(
    replace(replace(lower(coalesce(valeur, '')), 'œ', 'oe'), 'æ', 'ae'),
    'àâäáãåçéèêëíìîïóòôöõúùûüýÿñ',
    'aaaaaaceeeeiiiiooooouuuuyyn'
  );
$$;

-- « Collège La Grâce » -> "college-la-grace"
create or replace function slug_ecole(valeur text)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(
      trim(both '-' from regexp_replace(normaliser_texte(valeur), '[^a-z0-9]+', '-', 'g')),
      ''
    ),
    'ecole'
  );
$$;

alter table ecoles add column if not exists slug text;

-- Ajoute un suffixe -2, -3... si le slug est déjà pris.
create or replace function generer_slug_ecole(p_nom text, p_ecole_id uuid default null)
returns text
language plpgsql
as $$
declare
  v_base text;
  v_slug text;
  v_n integer := 1;
begin
  v_base := slug_ecole(p_nom);
  v_slug := v_base;

  while exists (
    select 1 from ecoles
     where slug = v_slug
       and (p_ecole_id is null or id <> p_ecole_id)
  ) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  return v_slug;
end $$;

-- Remplissage des écoles existantes, une par une pour éviter les collisions.
do $$
declare
  r record;
begin
  for r in select id, nom from ecoles where slug is null or slug = '' loop
    update ecoles set slug = generer_slug_ecole(r.nom, r.id) where id = r.id;
  end loop;
end $$;

create unique index if not exists ecoles_slug_unique on ecoles (slug);

-- Toute nouvelle école reçoit son slug automatiquement, même hors application.
create or replace function trigger_slug_ecole() returns trigger
language plpgsql
as $$
begin
  if new.slug is null or new.slug = '' then
    new.slug := generer_slug_ecole(new.nom, new.id);
  end if;
  return new;
end $$;

drop trigger if exists ecoles_slug_insert on ecoles;
create trigger ecoles_slug_insert
  before insert on ecoles
  for each row execute function trigger_slug_ecole();

-- Visibilité de l'élève sur le portail et photo facultative.
alter table eleves add column if not exists masque_portail boolean not null default false;
alter table eleves add column if not exists photo_url text;

create index if not exists eleves_portail_idx
  on eleves (ecole_id, annee_scolaire, classe_id, statut, masque_portail);

-- Journal des envois de bulletins WhatsApp (offre PREMIUM).
create table if not exists bulletin_envois (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  eleve_id       uuid        not null,
  annee_scolaire text        not null,
  trimestre      smallint    not null check (trimestre between 1 and 3),
  telephone      text        not null,
  statut         text        not null default 'EN_ATTENTE'
                 check (statut in ('EN_ATTENTE', 'LIEN_PRET', 'ENVOYE', 'ECHEC')),
  message        text,
  url_whatsapp   text,
  erreur         text,
  envoye_le      timestamptz,
  date_creation  timestamptz not null default now(),
  unique (eleve_id, annee_scolaire, trimestre),
  constraint bulletin_eleve_ecole_fk
    foreign key (eleve_id, ecole_id) references eleves (id, ecole_id)
    on delete cascade
);

create index if not exists bulletin_envois_ecole_idx
  on bulletin_envois (ecole_id, annee_scolaire, trimestre, statut);

-- ===========================================================================
--  SAISIE DES NOTES PAR LES PROFESSEURS
--
--  Fonctionnement :
--   • Le directeur crée un compte professeur (nom complet, téléphone,
--     identifiant, mot de passe). Aucune classe ni matière n'est imposée.
--   • Le professeur choisit lui-même Classe + Matière et verrouille la
--     combinaison pour le trimestre en cours (`saisies_notes`).
--   • Il enregistre un brouillon, puis envoie au directeur (statut ENVOYE).
--   • Le directeur corrige si besoin, libère ou valide et publie
--     (statut VALIDE). Les notes ne sont visibles sur le portail parent
--     qu'après cette validation.
-- ===========================================================================

-- 1. Comptes professeurs : les identifiants vivent dans `users` pour partager
--    la même session, le même middleware et les mêmes protections que le
--    directeur. Un professeur n'a pas forcément d'email : la colonne devient
--    facultative (l'index unique tolère plusieurs valeurs nulles).
alter table users alter column email drop not null;
alter table users add column if not exists identifiant text;

alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('directeur', 'secretaire', 'comptable', 'prof'));

-- L'identifiant sert à la connexion : il doit être unique sur toute la
-- plateforme, car le professeur ne choisit pas son école à la connexion.
create unique index if not exists users_identifiant_unique
  on users (lower(identifiant))
  where identifiant is not null;

-- Lien entre la fiche pédagogique et le compte de connexion.
alter table profs add column if not exists user_id uuid
  references users (id) on delete set null;

create unique index if not exists profs_user_unique
  on profs (user_id)
  where user_id is not null;

-- 2. Évaluations d'une matière : Devoir 1, Devoir 2, Composition.
--    `notes.note` reste la moyenne de la matière (calculée à l'enregistrement)
--    pour que les bulletins, les rangs et les PDF existants continuent de
--    fonctionner sans changement.
alter table notes add column if not exists devoir1 numeric(4, 2)
  check (devoir1 >= 0 and devoir1 <= 20);
alter table notes add column if not exists devoir2 numeric(4, 2)
  check (devoir2 >= 0 and devoir2 <= 20);
alter table notes add column if not exists composition numeric(4, 2)
  check (composition >= 0 and composition <= 20);

-- 3. Verrou d'une combinaison Classe + Matière + Trimestre.
--    Une seule ligne active (EN_COURS, ENVOYE ou VALIDE) par combinaison.
create table if not exists saisies_notes (
  id             uuid primary key default gen_random_uuid(),
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  annee_scolaire text        not null,
  trimestre      smallint    not null check (trimestre between 1 and 3),
  classe_id      uuid        not null,
  matiere_id     uuid        not null,
  -- null = saisie directe du directeur (aucun professeur associé).
  prof_id        uuid        references profs (id) on delete set null,
  statut         text        not null default 'EN_COURS'
                 check (statut in ('EN_COURS', 'ENVOYE', 'VALIDE', 'LIBERE')),
  envoye_le      timestamptz,
  valide_le      timestamptz,
  valide_par     uuid        references users (id) on delete set null,
  libere_le      timestamptz,
  libere_par     uuid        references users (id) on delete set null,
  motif_liberation text,
  date_creation  timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (id, ecole_id),
  constraint saisie_classe_ecole_fk
    foreign key (classe_id, ecole_id) references classes (id, ecole_id)
    on delete cascade,
  constraint saisie_matiere_ecole_fk
    foreign key (matiere_id, ecole_id) references matieres (id, ecole_id)
    on delete cascade
);

create unique index if not exists saisies_notes_verrou_unique
  on saisies_notes (ecole_id, annee_scolaire, trimestre, classe_id, matiere_id)
  where statut in ('EN_COURS', 'ENVOYE', 'VALIDE');

create index if not exists saisies_notes_ecole_idx
  on saisies_notes (ecole_id, annee_scolaire, trimestre, statut);

create index if not exists saisies_notes_prof_idx
  on saisies_notes (prof_id, annee_scolaire, trimestre);

drop trigger if exists saisies_notes_updated_at on saisies_notes;
create trigger saisies_notes_updated_at
  before update on saisies_notes
  for each row execute function maj_updated_at();

-- 4. Date limite de dépôt des notes, définie par le directeur
--    (« Notes à envoyer avant le 20 du mois »).
create table if not exists notes_echeances (
  ecole_id       uuid        not null references ecoles (id) on delete cascade,
  annee_scolaire text        not null,
  trimestre      smallint    not null check (trimestre between 1 and 3),
  date_limite    date        not null,
  updated_at     timestamptz not null default now(),
  primary key (ecole_id, annee_scolaire, trimestre)
);

-- 5. Reprise des notes déjà saisies avant cette évolution : elles ont été
--    saisies par le directeur, donc considérées comme validées et publiées.
insert into saisies_notes
  (ecole_id, annee_scolaire, trimestre, classe_id, matiere_id, statut, valide_le)
select distinct n.ecole_id, n.annee_scolaire, n.trimestre, e.classe_id,
       n.matiere_id, 'VALIDE', now()
  from notes n
  join eleves e on e.id = n.eleve_id
on conflict do nothing;

commit;
