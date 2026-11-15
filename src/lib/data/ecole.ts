import { sql, uneLigne } from "../db";
import type { Ecole, Role } from "../types";

export { limitesOffre } from "../offres";

export async function getEcole(ecoleId: string): Promise<Ecole | null> {
  return uneLigne<Ecole>(
    `select id, nom, slug, adresse, telephone, email, logo_url, offre, statut,
            date_fin_essai::text as date_fin_essai,
            date_fin_abonnement::text as date_fin_abonnement,
            actif, recu_compteur,
            modele_recu, modele_relance
       from ecoles
      where id = $1`,
    [ecoleId],
  );
}

export type UtilisateurEcole = {
  id: string;
  nom: string;
  email: string;
  role: Role;
  actif: boolean;
  derniere_connexion: string | null;
  date_creation: string;
};

/** Comptes de l'école (directeur + secrétaires), pour la page Paramètres. */
export async function listerUtilisateurs(
  ecoleId: string,
): Promise<UtilisateurEcole[]> {
  return sql<UtilisateurEcole>(
    `select id, nom, email, role, actif,
            to_char(derniere_connexion, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as derniere_connexion,
            to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation
       from users
      where ecole_id = $1
      order by case role when 'directeur' then 0 else 1 end, nom`,
    [ecoleId],
  );
}

export async function compterElevesActifs(
  ecoleId: string,
  annee: string,
): Promise<number> {
  const ligne = await uneLigne<{ total: number }>(
    `select count(*)::int as total
       from eleves
      where ecole_id = $1 and annee_scolaire = $2 and statut = 'actif'`,
    [ecoleId, annee],
  );
  return ligne?.total ?? 0;
}

export async function compterClasses(ecoleId: string): Promise<number> {
  const ligne = await uneLigne<{ total: number }>(
    `select count(*)::int as total from classes where ecole_id = $1`,
    [ecoleId],
  );
  return ligne?.total ?? 0;
}

/** Comptes actifs de l'école (tous rôles), pour les limites d'offre. */
export async function compterUtilisateurs(ecoleId: string): Promise<number> {
  const ligne = await uneLigne<{ total: number }>(
    `select count(*)::int as total from users where ecole_id = $1 and actif = true`,
    [ecoleId],
  );
  return ligne?.total ?? 0;
}

/** Jours restants d'essai (0 si terminé). */
export function joursEssaiRestants(dateFin: string | null): number | null {
  if (!dateFin) return null;
  const fin = new Date(`${dateFin}T23:59:59`);
  const difference = fin.getTime() - Date.now();
  return Math.max(0, Math.ceil(difference / 86_400_000));
}
