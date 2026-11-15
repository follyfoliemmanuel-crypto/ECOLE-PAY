import { Pool, type PoolClient, type QueryResultRow } from "pg";

/**
 * Connexion PostgreSQL unique par instance de serveur.
 * Compatible Neon (connexion poolée), Supabase et Postgres local.
 */
let pool: Pool | null = null;

function creerPool(): Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL est absent. Copiez .env.example vers .env.local et renseignez la connexion PostgreSQL.",
    );
  }

  const sslRequis =
    /sslmode=(require|verify)/.test(url) || /neon\.tech|supabase\.co/.test(url);

  return new Pool({
    connectionString: url,
    ssl: sslRequis ? { rejectUnauthorized: false } : undefined,
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

export function getPool(): Pool {
  if (!pool) pool = creerPool();
  return pool;
}

/** Exécute une requête et renvoie les lignes. */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  requete: string,
  parametres: unknown[] = [],
): Promise<T[]> {
  const resultat = await getPool().query<T>(requete, parametres as never[]);
  return resultat.rows;
}

/** Exécute une requête et renvoie la première ligne (ou null). */
export async function uneLigne<T extends QueryResultRow = QueryResultRow>(
  requete: string,
  parametres: unknown[] = [],
): Promise<T | null> {
  const lignes = await sql<T>(requete, parametres);
  return lignes[0] ?? null;
}

/** Transaction : indispensable pour l'inscription et la création d'un paiement. */
export async function transaction<T>(
  travail: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    const resultat = await travail(client);
    await client.query("commit");
    return resultat;
  } catch (erreur) {
    await client.query("rollback");
    throw erreur;
  } finally {
    client.release();
  }
}
