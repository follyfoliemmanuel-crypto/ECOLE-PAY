import { sql } from "./db";

/**
 * File d'attente persistante (table `taches`).
 *
 * Pourquoi une table et pas Redis ? Le plan Neon Free n'inclut pas de file
 * managée. Une table + `for update skip locked` donne la même garantie
 * (aucun doublon, reprise sur erreur) sans service supplémentaire ni coût.
 *
 * Les tâches sont réservées par le worker `/api/taches` (cron Vercel) puis
 * exécutées hors de la requête de l'utilisateur : une école ne paie jamais
 * la latence d'un envoi WhatsApp ou d'un gros calcul.
 */

export type TypeTache = "BULLETIN_WHATSAPP" | "RAPPORT";

export type StatutTache = "EN_ATTENTE" | "EN_COURS" | "TERMINE" | "ECHEC";

export type Tache = {
  id: string;
  ecole_id: string | null;
  type: TypeTache;
  statut: StatutTache;
  charge: Record<string, unknown>;
  tentatives: number;
  erreur: string | null;
};

/** Nombre maximal de tentatives avant de classer la tâche en échec définitif. */
export const TENTATIVES_MAX = 3;

/**
 * Empile une tâche. `executeApres` permet de décaler un envoi (anti-flood).
 * Renvoie l'identifiant de la tâche, ou `null` si l'insertion a échoué :
 * l'appelant ne doit jamais faire échouer l'action métier pour la file.
 */
export async function empilerTache({
  ecoleId,
  type,
  charge,
  executeApres,
}: {
  ecoleId: string | null;
  type: TypeTache;
  charge: Record<string, unknown>;
  executeApres?: Date;
}): Promise<string | null> {
  try {
    const lignes = await sql<{ id: string }>(
      `insert into taches (ecole_id, type, charge, execute_apres)
       values ($1, $2, $3::jsonb, coalesce($4::timestamptz, now()))
       returning id`,
      [ecoleId, type, JSON.stringify(charge), executeApres ?? null],
    );
    return lignes[0]?.id ?? null;
  } catch (erreur) {
    console.error("File d'attente indisponible :", {
      code: (erreur as { code?: string })?.code,
      type,
    });
    return null;
  }
}

/**
 * Réserve jusqu'à `limite` tâches prêtes.
 * `for update skip locked` garantit que deux workers simultanés ne prennent
 * jamais la même ligne, sans verrou bloquant.
 */
export async function reserverTaches(limite = 5): Promise<Tache[]> {
  if (limite <= 0) return [];
  return sql<Tache>(
    `with candidates as (
       select id
         from taches
        where statut = 'EN_ATTENTE'
          and execute_apres <= now()
        order by execute_apres, date_creation
        limit $1
        for update skip locked
     )
     update taches t
        set statut = 'EN_COURS',
            tentatives = t.tentatives + 1,
            erreur = null,
            updated_at = now()
       from candidates c
      where t.id = c.id
      returning t.id, t.ecole_id, t.type, t.statut, t.charge,
                t.tentatives, t.erreur`,
    [limite],
  );
}

/** Marque une tâche comme réussie. */
export async function terminerTache(id: string): Promise<void> {
  await sql(
    `update taches
        set statut = 'TERMINE', erreur = null, updated_at = now()
      where id = $1`,
    [id],
  );
}

/**
 * Enregistre un échec. Tant qu'il reste des tentatives, la tâche retourne
 * en attente avec un délai croissant (1 min, 2 min, 4 min…) pour ne pas
 * marteler une API externe en panne.
 */
export async function echouerTache(id: string, erreur: string): Promise<void> {
  await sql(
    `update taches
        set statut = case when tentatives >= $2 then 'ECHEC' else 'EN_ATTENTE' end,
            erreur = left($3, 500),
            execute_apres = case
              when tentatives >= $2 then execute_apres
              else now() + make_interval(secs => (60 * power(2, tentatives))::int)
            end,
            updated_at = now()
      where id = $1`,
    [id, TENTATIVES_MAX, erreur],
  );
}

/** Remet en attente les tâches bloquées en `EN_COURS` (worker tué en plein vol). */
export async function recyclerTachesBloquees(minutes = 15): Promise<number> {
  const lignes = await sql<{ id: string }>(
    `update taches
        set statut = case when tentatives >= $2 then 'ECHEC' else 'EN_ATTENTE' end,
            erreur = coalesce(erreur, 'Worker interrompu.'),
            updated_at = now()
      where statut = 'EN_COURS'
        and updated_at < now() - make_interval(mins => $1)
      returning id`,
    [Math.max(1, Math.floor(minutes)), TENTATIVES_MAX],
  );
  return lignes.length;
}

/** Compte les tâches en attente, éventuellement pour une école. */
export async function compterTachesEnAttente(
  ecoleId?: string,
): Promise<number> {
  const lignes = await sql<{ total: string }>(
    `select count(*)::text as total
       from taches
      where statut in ('EN_ATTENTE', 'EN_COURS')
        and ($1::uuid is null or ecole_id = $1::uuid)`,
    [ecoleId ?? null],
  );
  return Number(lignes[0]?.total ?? 0);
}
