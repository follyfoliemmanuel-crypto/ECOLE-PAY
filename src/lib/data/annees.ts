import { sql, uneLigne } from "../db";
import { anneeScolaire } from "../mois";
import { anneeSuivante, bornesAnnee, bornesTrimestre } from "../annees";
import type {
  Absence,
  AnneeScolaire,
  DecisionFinAnnee,
  Inscription,
  Rapport,
  StatutEleve,
  StatutInscription,
  TypeFinClasse,
  ExamenNational,
} from "../types";

// ---------------------------------------------------------------------------
//  Années scolaires
// ---------------------------------------------------------------------------

type LigneAnnee = {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: "OUVERTE" | "CLOTUREE";
  cloturee_le: string | null;
  nb_eleves: number;
  nb_sortis: number;
};

/** Crée l'année si elle n'existe pas encore, sans écraser son statut. */
export async function assurerAnnee(
  ecoleId: string,
  libelle: string,
): Promise<void> {
  const bornes = bornesAnnee(libelle);
  await sql(
    `insert into annees_scolaires
       (ecole_id, libelle, date_debut, date_fin, statut)
     values ($1, $2, $3::date, $4::date, 'OUVERTE')
     on conflict (ecole_id, libelle) do nothing`,
    [ecoleId, libelle, bornes.debut, bornes.fin],
  );
}

/**
 * Année réellement ouverte pour l'école. C'est elle que toutes les pages et
 * actions utilisent : après une clôture en juillet, l'école travaille déjà sur
 * l'année suivante, tandis que l'ancienne reste consultable dans l'archive.
 */
export async function anneeActive(ecoleId: string): Promise<string> {
  const ouverte = await uneLigne<{ libelle: string }>(
    `select libelle
       from annees_scolaires
      where ecole_id = $1 and statut = 'OUVERTE'
      order by libelle desc
      limit 1`,
    [ecoleId],
  );
  if (ouverte) return ouverte.libelle;

  const derniere = await uneLigne<{ libelle: string }>(
    `select libelle
       from annees_scolaires
      where ecole_id = $1
      order by libelle desc
      limit 1`,
    [ecoleId],
  );

  const annee = derniere
    ? anneeSuivante(derniere.libelle)
    : anneeScolaire();
  await assurerAnnee(ecoleId, annee);
  return annee;
}

export async function anneeEstOuverte(
  ecoleId: string,
  annee: string,
): Promise<boolean> {
  const ligne = await uneLigne<{ statut: string }>(
    `select statut from annees_scolaires
      where ecole_id = $1 and libelle = $2`,
    [ecoleId, annee],
  );
  return ligne?.statut === "OUVERTE";
}

export async function listerAnnees(ecoleId: string): Promise<AnneeScolaire[]> {
  await anneeActive(ecoleId);
  const lignes = await sql<LigneAnnee>(
    `select a.id, a.libelle,
            a.date_debut::text as date_debut,
            a.date_fin::text as date_fin,
            a.statut,
            to_char(a.cloturee_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as cloturee_le,
            (select count(*)::int from inscriptions i
              where i.ecole_id = a.ecole_id
                and i.annee_scolaire = a.libelle) as nb_eleves,
            (select count(*)::int from inscriptions i
              where i.ecole_id = a.ecole_id
                and i.annee_scolaire = a.libelle
                and i.statut in ('TRANSFERE', 'DIPLOME')) as nb_sortis
       from annees_scolaires a
      where a.ecole_id = $1
      order by a.libelle desc`,
    [ecoleId],
  );
  return lignes;
}

export async function getAnnee(
  ecoleId: string,
  annee: string,
): Promise<AnneeScolaire | null> {
  const ligne = await uneLigne<LigneAnnee>(
    `select a.id, a.libelle,
            a.date_debut::text as date_debut,
            a.date_fin::text as date_fin,
            a.statut,
            to_char(a.cloturee_le, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as cloturee_le,
            (select count(*)::int from inscriptions i
              where i.ecole_id = a.ecole_id
                and i.annee_scolaire = a.libelle) as nb_eleves,
            (select count(*)::int from inscriptions i
              where i.ecole_id = a.ecole_id
                and i.annee_scolaire = a.libelle
                and i.statut in ('TRANSFERE', 'DIPLOME')) as nb_sortis
       from annees_scolaires a
      where a.ecole_id = $1 and a.libelle = $2`,
    [ecoleId, annee],
  );
  return ligne;
}

// ---------------------------------------------------------------------------
//  Aperçu de clôture
// ---------------------------------------------------------------------------

export type DecisionAuto =
  | "PASSE"
  | "REDOUBLE"
  | "DIPLOME"
  | "TRANSFERE"
  | "INACTIF"
  | "EXAMEN";

export type LigneCloture = {
  eleve_id: string;
  nom: string;
  prenom: string;
  statut_eleve: StatutEleve;
  classe_id: string;
  classe_nom: string;
  type_fin: TypeFinClasse;
  examen: ExamenNational | null;
  classe_suivante_id: string | null;
  classe_suivante_nom: string | null;
  moyenne_annuelle: number | null;
  decision_auto: DecisionAuto;
  decision_existante: DecisionFinAnnee | null;
  statut_inscription: StatutInscription;
};

export type ClasseCloture = {
  classe_id: string;
  classe_nom: string;
  type_fin: TypeFinClasse;
  examen: ExamenNational | null;
  classe_suivante_id: string | null;
  classe_suivante_nom: string | null;
  effectif: number;
  promus: number;
  redoublants: number;
  examens: number;
};

export type ApercuCloture = {
  annee: string;
  annee_suivante: string;
  statut: "OUVERTE" | "CLOTUREE" | "ABSENTE";
  eleves: LigneCloture[];
  classes: ClasseCloture[];
  avertissements: string[];
  bloquants: string[];
  peut_cloturer: boolean;
};

type LigneClotureSql = {
  eleve_id: string;
  nom: string;
  prenom: string;
  statut_eleve: StatutEleve;
  classe_id: string;
  classe_nom: string;
  type_fin: TypeFinClasse;
  examen: ExamenNational | null;
  classe_suivante_id: string | null;
  classe_suivante_nom: string | null;
  statut_inscription: StatutInscription;
  decision_existante: DecisionFinAnnee | null;
  moyenne_calculee: number | null;
};

export async function apercuCloture(
  ecoleId: string,
  annee: string,
): Promise<ApercuCloture> {
  const [anneeLigne, lignes, moyennes] = await Promise.all([
    getAnnee(ecoleId, annee),
    sql<LigneClotureSql>(
      `select i.eleve_id, e.nom, e.prenom, e.statut as statut_eleve,
              i.classe_id, c.nom as classe_nom, c.type_fin, c.examen,
              c.classe_suivante_id, cs.nom as classe_suivante_nom,
              i.statut as statut_inscription,
              i.decision as decision_existante,
              i.moyenne_annuelle::float8 as moyenne_annuelle
         from inscriptions i
         join eleves e on e.id = i.eleve_id
         join classes c on c.id = i.classe_id
         left join classes cs on cs.id = c.classe_suivante_id
        where i.ecole_id = $1 and i.annee_scolaire = $2
        order by c.ordre, c.nom, e.nom, e.prenom`,
      [ecoleId, annee],
    ),
    sql<{ eleve_id: string; moyenne: number }>(
      `select n.eleve_id,
              round(sum(n.note * m.coefficient)
                    / nullif(sum(m.coefficient), 0), 2)::float8 as moyenne
         from notes n
         join matieres m on m.id = n.matiere_id and m.ecole_id = n.ecole_id
        where n.ecole_id = $1 and n.annee_scolaire = $2
        group by n.eleve_id`,
      [ecoleId, annee],
    ),
  ]);

  const moyenneParEleve = new Map(
    moyennes.map((ligne) => [ligne.eleve_id, ligne.moyenne]),
  );

  const eleves: LigneCloture[] = lignes.map((ligne) => {
    const moyenne =
      ligne.moyenne_calculee ?? moyenneParEleve.get(ligne.eleve_id) ?? null;

    let decision: DecisionAuto = "REDOUBLE";
    if (ligne.statut_eleve === "transfere") decision = "TRANSFERE";
    else if (ligne.statut_eleve === "diplome") decision = "DIPLOME";
    else if (ligne.statut_eleve === "inactif") decision = "INACTIF";
    else if (ligne.type_fin === "EXAMEN") decision = "EXAMEN";
    else if (moyenne !== null && moyenne >= 10) decision = "PASSE";

    return {
      eleve_id: ligne.eleve_id,
      nom: ligne.nom,
      prenom: ligne.prenom,
      statut_eleve: ligne.statut_eleve,
      classe_id: ligne.classe_id,
      classe_nom: ligne.classe_nom,
      type_fin: ligne.type_fin,
      examen: ligne.examen,
      classe_suivante_id: ligne.classe_suivante_id,
      classe_suivante_nom: ligne.classe_suivante_nom,
      moyenne_annuelle: moyenne,
      decision_auto: decision,
      decision_existante: ligne.decision_existante,
      statut_inscription: ligne.statut_inscription,
    };
  });

  const parClasse = new Map<string, ClasseCloture>();
  for (const eleve of eleves) {
    const existante = parClasse.get(eleve.classe_id);
    const classe: ClasseCloture =
      existante ??
      {
        classe_id: eleve.classe_id,
        classe_nom: eleve.classe_nom,
        type_fin: eleve.type_fin,
        examen: eleve.examen,
        classe_suivante_id: eleve.classe_suivante_id,
        classe_suivante_nom: eleve.classe_suivante_nom,
        effectif: 0,
        promus: 0,
        redoublants: 0,
        examens: 0,
      };
    classe.effectif += 1;
    if (eleve.decision_auto === "PASSE") classe.promus += 1;
    else if (eleve.decision_auto === "EXAMEN") classe.examens += 1;
    else if (eleve.decision_auto === "REDOUBLE") classe.redoublants += 1;
    parClasse.set(eleve.classe_id, classe);
  }

  const avertissements: string[] = [];
  const bloquants: string[] = [];

  for (const classe of parClasse.values()) {
    if (classe.type_fin === "EXAMEN" && !classe.examen) {
      bloquants.push(
        `La classe ${classe.classe_nom} est une classe d'examen mais aucun examen (CEPD, BEPC, BAC) n'est renseigné.`,
      );
    }
    if (
      classe.type_fin === "NORMALE" &&
      classe.promus > 0 &&
      !classe.classe_suivante_id
    ) {
      bloquants.push(
        `${classe.classe_nom} : ${classe.promus} élève${classe.promus > 1 ? "s" : ""} doi${classe.promus > 1 ? "vent" : "t"} passer, mais aucune classe suivante n'est configurée.`,
      );
    }
  }

  const examens = eleves.filter((eleve) => eleve.decision_auto === "EXAMEN");
  if (examens.length > 0) {
    avertissements.push(
      `${examens.length} élève${examens.length > 1 ? "s" : ""} de classe d'examen doi${examens.length > 1 ? "vent" : "t"} recevoir une décision manuelle (admis ou échoué).`,
    );
  }

  const sansMoyenne = eleves.filter(
    (eleve) =>
      eleve.statut_eleve === "actif" &&
      eleve.type_fin === "NORMALE" &&
      eleve.moyenne_annuelle === null,
  );
  if (sansMoyenne.length > 0) {
    avertissements.push(
      `${sansMoyenne.length} élève${sansMoyenne.length > 1 ? "s" : ""} sans note : il${sansMoyenne.length > 1 ? "s seront considérés" : " sera considéré"} comme redoublant${sansMoyenne.length > 1 ? "s" : ""}.`,
    );
  }

  const sortis = eleves.filter((eleve) =>
    ["transfere", "diplome", "inactif"].includes(eleve.statut_eleve),
  );
  if (sortis.length > 0) {
    avertissements.push(
      `${sortis.length} élève${sortis.length > 1 ? "s" : ""} déjà sorti${sortis.length > 1 ? "s" : ""} (transfert, diplôme ou inactif) conserve${sortis.length > 1 ? "nt" : ""} son archive sans nouvelle inscription.`,
    );
  }

  if (eleves.length === 0) {
    bloquants.push(
      "Aucun élève n'est inscrit sur cette année : la clôture n'aurait rien à traiter.",
    );
  }

  return {
    annee,
    annee_suivante: anneeSuivante(annee),
    statut: anneeLigne?.statut ?? "ABSENTE",
    eleves,
    classes: Array.from(parClasse.values()),
    avertissements,
    bloquants,
    peut_cloturer: anneeLigne?.statut === "OUVERTE" && bloquants.length === 0,
  };
}

// ---------------------------------------------------------------------------
//  Archive d'une année
// ---------------------------------------------------------------------------

export type LigneArchiveEleve = Inscription & {
  nom: string;
  prenom: string;
  statut_eleve: StatutEleve;
  /** Trimestres pour lesquels au moins une note existe. */
  trimestres: number[];
};

export type ClasseArchive = {
  classe_id: string;
  classe_nom: string;
  effectif: number;
  moyenne: number | null;
  taux_reussite: number | null;
  attendu: number;
  encaisse: number;
  impaye: number;
  absences: number;
};

export type PaiementArchive = {
  id: string;
  numero_recu: string;
  montant: number;
  mode_paiement: string;
  date_paiement: string;
  annule: boolean;
  eleve_nom: string;
  eleve_prenom: string;
  classe_nom: string | null;
  type_frais: string;
  libelle: string | null;
};

export type NotesClasseArchive = {
  classe_id: string;
  classe_nom: string;
  trimestre: number;
  nb_notes: number;
  nb_eleves: number;
};

export type TrimestreArchive = {
  trimestre: 1 | 2 | 3;
  moyenne: number | null;
  encaisse: number;
  absences: number;
  taux_reussite: number | null;
};

export type ResumeArchive = {
  annee: AnneeScolaire;
  eleves: LigneArchiveEleve[];
  classes: ClasseArchive[];
  paiements: PaiementArchive[];
  absences: Absence[];
  notes: NotesClasseArchive[];
  trimestres: TrimestreArchive[];
  rapports: Rapport[];
  indicateurs: {
    eleves: number;
    sortis: number;
    moyenne_generale: number | null;
    taux_reussite: number | null;
    encaisse: number;
    attendu: number;
    impaye: number;
    absences: number;
    notes: number;
    promus: number;
    redoublants: number;
    diplomes: number;
    transferes: number;
  };
};

function arrondi(valeur: number): number {
  return Math.round(valeur * 100) / 100;
}

export async function listerInscriptionsAnnee(
  ecoleId: string,
  annee: string,
): Promise<LigneArchiveEleve[]> {
  const lignes = await sql<
    LigneArchiveEleve & { moyenne_annuelle: number | null }
  >(
    `select i.id, i.eleve_id, i.annee_scolaire, i.classe_id, c.nom as classe_nom,
            i.type_inscription, i.statut, i.decision,
            i.moyenne_annuelle::float8 as moyenne_annuelle,
            i.date_inscription::text as date_inscription,
            i.date_sortie::text as date_sortie,
            i.ecole_destination,
            e.nom, e.prenom, e.statut as statut_eleve,
            coalesce((
              select array_agg(distinct n.trimestre order by n.trimestre)
                from notes n
               where n.ecole_id = i.ecole_id
                 and n.annee_scolaire = i.annee_scolaire
                 and n.eleve_id = i.eleve_id
            ), '{}'::smallint[]) as trimestres
       from inscriptions i
       join eleves e on e.id = i.eleve_id
       join classes c on c.id = i.classe_id
      where i.ecole_id = $1 and i.annee_scolaire = $2
      order by c.ordre, c.nom, e.nom, e.prenom`,
    [ecoleId, annee],
  );
  return lignes;
}

export async function listerAbsences(
  ecoleId: string,
  annee: string,
  options: { eleveId?: string; limite?: number } = {},
): Promise<Absence[]> {
  const limite = Math.max(1, Math.min(options.limite ?? 200, 500));
  return sql<Absence>(
    `select a.id, a.eleve_id, e.nom, e.prenom,
            a.date_absence::text as date_absence,
            a.trimestre, a.motif, a.justifiee
       from absences a
       join eleves e on e.id = a.eleve_id
      where a.ecole_id = $1
        and a.annee_scolaire = $2
        and ($3::uuid is null or a.eleve_id = $3::uuid)
      order by a.date_absence desc, a.date_creation desc
      limit $4`,
    [ecoleId, annee, options.eleveId ?? null, limite],
  );
}

export async function compterAbsencesEleve(
  ecoleId: string,
  annee: string,
  eleveId: string,
): Promise<{ total: number; justifiees: number }> {
  const ligne = await uneLigne<{ total: number; justifiees: number }>(
    `select count(*)::int as total,
            count(*) filter (where justifiee)::int as justifiees
       from absences
      where ecole_id = $1 and annee_scolaire = $2 and eleve_id = $3`,
    [ecoleId, annee, eleveId],
  );
  return { total: ligne?.total ?? 0, justifiees: ligne?.justifiees ?? 0 };
}

async function moyenneGlobale(
  ecoleId: string,
  annee: string,
  trimestre?: 1 | 2 | 3,
): Promise<{ moyenne: number | null; reussis: number; evalues: number }> {
  const ligne = await uneLigne<{
    moyenne: number | null;
    reussis: number;
    evalues: number;
  }>(
    `with moyennes as (
       select n.eleve_id,
              sum(n.note * m.coefficient)
                / nullif(sum(m.coefficient), 0) as valeur
         from notes n
         join matieres m on m.id = n.matiere_id and m.ecole_id = n.ecole_id
        where n.ecole_id = $1
          and n.annee_scolaire = $2
          and ($3::smallint is null or n.trimestre = $3::smallint)
        group by n.eleve_id
     )
     select round(avg(valeur), 2)::float8 as moyenne,
            count(*) filter (where valeur >= 10)::int as reussis,
            count(*)::int as evalues
       from moyennes`,
    [ecoleId, annee, trimestre ?? null],
  );
  return {
    moyenne: ligne?.moyenne ?? null,
    reussis: ligne?.reussis ?? 0,
    evalues: ligne?.evalues ?? 0,
  };
}

export async function resumeArchive(
  ecoleId: string,
  annee: string,
): Promise<ResumeArchive | null> {
  const anneeLigne = await getAnnee(ecoleId, annee);
  if (!anneeLigne) return null;

  const [
    eleves,
    paiements,
    absences,
    notes,
    rapports,
    finances,
    compteurs,
    global,
    classesBase,
    financesClasse,
    moyennesClasse,
    absencesClasse,
  ] = await Promise.all([
    listerInscriptionsAnnee(ecoleId, annee),
    sql<PaiementArchive>(
      `select p.id, p.numero_recu, p.montant, p.mode_paiement,
              to_char(p.date_paiement, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_paiement,
              p.annule,
              e.nom as eleve_nom, e.prenom as eleve_prenom,
              c.nom as classe_nom,
              p.type_frais, p.libelle
         from paiements p
         join eleves e on e.id = p.eleve_id
         join frais f on f.id = p.frais_id
         left join inscriptions i
           on i.eleve_id = p.eleve_id
          and i.annee_scolaire = f.annee_scolaire
         left join classes c on c.id = i.classe_id
        where p.ecole_id = $1 and f.annee_scolaire = $2
        order by p.date_paiement desc
        limit 200`,
      [ecoleId, annee],
    ),
    listerAbsences(ecoleId, annee, { limite: 200 }),
    sql<NotesClasseArchive>(
      `select i.classe_id, c.nom as classe_nom, n.trimestre,
              count(*)::int as nb_notes,
              count(distinct n.eleve_id)::int as nb_eleves
         from notes n
         join inscriptions i
           on i.eleve_id = n.eleve_id
          and i.annee_scolaire = n.annee_scolaire
          and i.ecole_id = n.ecole_id
         join classes c on c.id = i.classe_id
        where n.ecole_id = $1 and n.annee_scolaire = $2
        group by i.classe_id, c.nom, n.trimestre, c.ordre
        order by c.ordre, c.nom, n.trimestre`,
      [ecoleId, annee],
    ),
    sql<Rapport & { date_creation: string }>(
      `select id, annee_scolaire, type, trimestre, statut, erreur,
              to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation,
              to_char(date_generation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_generation
         from rapports
        where ecole_id = $1 and annee_scolaire = $2
        order by type, trimestre`,
      [ecoleId, annee],
    ),
    uneLigne<{ attendu: number; encaisse: number; impaye: number }>(
      `select coalesce(sum(montant_du), 0)::int as attendu,
              coalesce(sum(montant_paye), 0)::int as encaisse,
              coalesce(sum(reste), 0)::int as impaye
         from frais
        where ecole_id = $1 and annee_scolaire = $2`,
      [ecoleId, annee],
    ),
    uneLigne<{
      notes: number;
      absences: number;
      promus: number;
      redoublants: number;
      diplomes: number;
      transferes: number;
    }>(
      `select
         (select count(*)::int from notes n
           where n.ecole_id = $1 and n.annee_scolaire = $2) as notes,
         (select count(*)::int from absences a
           where a.ecole_id = $1 and a.annee_scolaire = $2) as absences,
         (select count(*)::int from inscriptions i
           where i.ecole_id = $1 and i.annee_scolaire = $2
             and i.statut = 'PROMU') as promus,
         (select count(*)::int from inscriptions i
           where i.ecole_id = $1 and i.annee_scolaire = $2
             and i.statut = 'REDOUBLANT') as redoublants,
         (select count(*)::int from inscriptions i
           where i.ecole_id = $1 and i.annee_scolaire = $2
             and i.statut = 'DIPLOME') as diplomes,
         (select count(*)::int from inscriptions i
           where i.ecole_id = $1 and i.annee_scolaire = $2
             and i.statut = 'TRANSFERE') as transferes`,
      [ecoleId, annee],
    ),
    moyenneGlobale(ecoleId, annee),
    sql<{ classe_id: string; classe_nom: string; effectif: number }>(
      `select i.classe_id, c.nom as classe_nom,
              count(distinct i.eleve_id)::int as effectif
         from inscriptions i
         join classes c on c.id = i.classe_id
        where i.ecole_id = $1 and i.annee_scolaire = $2
        group by i.classe_id, c.nom, c.ordre
        order by c.ordre, c.nom`,
      [ecoleId, annee],
    ),
    sql<{
      classe_id: string;
      attendu: number;
      encaisse: number;
      impaye: number;
    }>(
      `select i.classe_id,
              coalesce(sum(f.montant_du), 0)::int as attendu,
              coalesce(sum(f.montant_paye), 0)::int as encaisse,
              coalesce(sum(f.reste), 0)::int as impaye
         from frais f
         join inscriptions i
           on i.eleve_id = f.eleve_id
          and i.annee_scolaire = f.annee_scolaire
          and i.ecole_id = f.ecole_id
        where f.ecole_id = $1 and f.annee_scolaire = $2
        group by i.classe_id`,
      [ecoleId, annee],
    ),
    sql<{
      classe_id: string;
      eleve_id: string;
      moyenne: number;
    }>(
      `select i.classe_id, n.eleve_id,
              round(sum(n.note * m.coefficient)
                    / nullif(sum(m.coefficient), 0), 2)::float8 as moyenne
         from notes n
         join matieres m on m.id = n.matiere_id and m.ecole_id = n.ecole_id
         join inscriptions i
           on i.eleve_id = n.eleve_id
          and i.annee_scolaire = n.annee_scolaire
          and i.ecole_id = n.ecole_id
        where n.ecole_id = $1 and n.annee_scolaire = $2
        group by i.classe_id, n.eleve_id`,
      [ecoleId, annee],
    ),
    sql<{ classe_id: string; total: number }>(
      `select i.classe_id, count(*)::int as total
         from absences a
         join inscriptions i
           on i.eleve_id = a.eleve_id
          and i.annee_scolaire = a.annee_scolaire
          and i.ecole_id = a.ecole_id
        where a.ecole_id = $1 and a.annee_scolaire = $2
        group by i.classe_id`,
      [ecoleId, annee],
    ),
  ]);

  const financesParClasse = new Map(
    financesClasse.map((ligne) => [ligne.classe_id, ligne]),
  );
  const absencesParClasse = new Map(
    absencesClasse.map((ligne) => [ligne.classe_id, ligne.total]),
  );

  const moyennesParClasse = new Map<string, number[]>();
  for (const ligne of moyennesClasse) {
    const liste = moyennesParClasse.get(ligne.classe_id) ?? [];
    liste.push(ligne.moyenne);
    moyennesParClasse.set(ligne.classe_id, liste);
  }

  const classes: ClasseArchive[] = classesBase.map((classe) => {
    const liste = moyennesParClasse.get(classe.classe_id) ?? [];
    const moyenne =
      liste.length > 0
        ? arrondi(liste.reduce((somme, valeur) => somme + valeur, 0) / liste.length)
        : null;
    const reussis = liste.filter((valeur) => valeur >= 10).length;
    const finance = financesParClasse.get(classe.classe_id);
    return {
      classe_id: classe.classe_id,
      classe_nom: classe.classe_nom,
      effectif: classe.effectif,
      moyenne,
      taux_reussite:
        liste.length > 0 ? Math.round((reussis / liste.length) * 100) : null,
      attendu: finance?.attendu ?? 0,
      encaisse: finance?.encaisse ?? 0,
      impaye: finance?.impaye ?? 0,
      absences: absencesParClasse.get(classe.classe_id) ?? 0,
    };
  });

  // Bilan par trimestre : moyennes, encaissements datés et absences.
  const trimestres: TrimestreArchive[] = [];
  for (const trimestre of [1, 2, 3] as const) {
    const bornes = bornesTrimestre(annee, trimestre);
    const [moyenne, paiementsTrimestre, absencesTrimestre] = await Promise.all([
      moyenneGlobale(ecoleId, annee, trimestre),
      uneLigne<{ total: number }>(
        `select coalesce(sum(p.montant), 0)::int as total
           from paiements p
           join frais f on f.id = p.frais_id
          where p.ecole_id = $1
            and f.annee_scolaire = $2
            and p.annule = false
            and p.date_paiement::date between $3::date and $4::date`,
        [ecoleId, annee, bornes.debut, bornes.fin],
      ),
      uneLigne<{ total: number }>(
        `select count(*)::int as total
           from absences
          where ecole_id = $1 and annee_scolaire = $2
            and date_absence between $3::date and $4::date`,
        [ecoleId, annee, bornes.debut, bornes.fin],
      ),
    ]);
    trimestres.push({
      trimestre,
      moyenne: moyenne.moyenne,
      taux_reussite:
        moyenne.evalues > 0
          ? Math.round((moyenne.reussis / moyenne.evalues) * 100)
          : null,
      encaisse: paiementsTrimestre?.total ?? 0,
      absences: absencesTrimestre?.total ?? 0,
    });
  }

  const sortis = eleves.filter((eleve) =>
    ["TRANSFERE", "DIPLOME"].includes(eleve.statut),
  ).length;

  return {
    annee: anneeLigne,
    eleves,
    classes,
    paiements,
    absences,
    notes,
    trimestres,
    rapports,
    indicateurs: {
      eleves: eleves.length,
      sortis,
      moyenne_generale: global.moyenne,
      taux_reussite:
        global.evalues > 0
          ? Math.round((global.reussis / global.evalues) * 100)
          : null,
      encaisse: finances?.encaisse ?? 0,
      attendu: finances?.attendu ?? 0,
      impaye: finances?.impaye ?? 0,
      absences: compteurs?.absences ?? 0,
      notes: compteurs?.notes ?? 0,
      promus: compteurs?.promus ?? 0,
      redoublants: compteurs?.redoublants ?? 0,
      diplomes: compteurs?.diplomes ?? 0,
      transferes: compteurs?.transferes ?? 0,
    },
  };
}

// ---------------------------------------------------------------------------
//  Rapports
// ---------------------------------------------------------------------------

export async function listerRapports(
  ecoleId: string,
  annee?: string,
): Promise<Rapport[]> {
  return sql<Rapport>(
    `select id, annee_scolaire, type, trimestre, statut, erreur,
            to_char(date_creation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_creation,
            to_char(date_generation, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as date_generation
       from rapports
      where ecole_id = $1
        and ($2::text is null or annee_scolaire = $2::text)
      order by date_creation desc
      limit 60`,
    [ecoleId, annee ?? null],
  );
}

export type ContenuRapport = {
  type: "TRIMESTRIEL" | "ANNUEL";
  annee: string;
  trimestre: number;
  libelle_periode: string;
  ecole: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    logo_url: string | null;
  };
  genere_le: string;
  resume: {
    eleves: number;
    classes: number;
    moyenne: number | null;
    taux_reussite: number | null;
    encaisse: number;
    attendu: number;
    impaye: number;
    absences: number;
  };
  classes: Array<{
    nom: string;
    effectif: number;
    moyenne: number | null;
    taux_reussite: number | null;
    encaisse: number;
    attendu: number;
    impaye: number;
    absences: number;
  }>;
  trimestres?: Array<{
    trimestre: number;
    moyenne: number | null;
    taux_reussite: number | null;
    encaisse: number;
    absences: number;
  }>;
  decisions?: {
    promus: number;
    redoublants: number;
    diplomes: number;
    transferes: number;
  };
};

export async function construireContenuRapport(
  ecoleId: string,
  annee: string,
  type: "TRIMESTRIEL" | "ANNUEL",
  trimestre: number,
): Promise<ContenuRapport> {
  const [ecole, archive] = await Promise.all([
    uneLigne<{
      nom: string;
      adresse: string | null;
      telephone: string | null;
      logo_url: string | null;
    }>(`select nom, adresse, telephone, logo_url from ecoles where id = $1`, [
      ecoleId,
    ]),
    resumeArchive(ecoleId, annee),
  ]);
  if (!ecole || !archive) throw new Error("École ou année introuvable.");

  const trimestreChoisi =
    type === "TRIMESTRIEL" && trimestre >= 1 && trimestre <= 3
      ? (trimestre as 1 | 2 | 3)
      : null;

  let moyenne = archive.indicateurs.moyenne_generale;
  let taux = archive.indicateurs.taux_reussite;
  let encaisse = archive.indicateurs.encaisse;
  let absences = archive.indicateurs.absences;
  let classes = archive.classes;

  if (trimestreChoisi) {
    const bilan = archive.trimestres.find(
      (ligne) => ligne.trimestre === trimestreChoisi,
    );
    moyenne = bilan?.moyenne ?? null;
    taux = bilan?.taux_reussite ?? null;
    encaisse = bilan?.encaisse ?? 0;
    absences = bilan?.absences ?? 0;
  }

  // Pour un rapport trimestriel, on recalcule la moyenne de chaque classe sur
  // le trimestre choisi (le résumé d'archive couvre l'année entière).
  if (trimestreChoisi) {
    const parClasse = await sql<{
      classe_id: string;
      moyenne: number | null;
      taux_reussite: number | null;
    }>(
      `with moyennes as (
         select i.classe_id, n.eleve_id,
                sum(n.note * m.coefficient)
                  / nullif(sum(m.coefficient), 0) as valeur
           from notes n
           join matieres m on m.id = n.matiere_id and m.ecole_id = n.ecole_id
           join inscriptions i
             on i.eleve_id = n.eleve_id
            and i.annee_scolaire = n.annee_scolaire
            and i.ecole_id = n.ecole_id
          where n.ecole_id = $1 and n.annee_scolaire = $2
            and n.trimestre = $3
          group by i.classe_id, n.eleve_id
       )
       select classe_id,
              round(avg(valeur), 2)::float8 as moyenne,
              round(100.0 * count(*) filter (where valeur >= 10)
                    / nullif(count(*), 0))::int as taux_reussite
         from moyennes
        group by classe_id`,
      [ecoleId, annee, trimestreChoisi],
    );
    const map = new Map(parClasse.map((ligne) => [ligne.classe_id, ligne]));
    classes = classes.map((classe) => {
      const calcul = map.get(classe.classe_id);
      return {
        ...classe,
        moyenne: calcul?.moyenne ?? null,
        taux_reussite: calcul?.taux_reussite ?? null,
      };
    });
  }

  return {
    type,
    annee,
    trimestre: trimestreChoisi ?? 0,
    libelle_periode: trimestreChoisi
      ? ["1er trimestre", "2e trimestre", "3e trimestre"][trimestreChoisi - 1]
      : "Année complète",
    ecole,
    genere_le: new Date().toISOString(),
    resume: {
      eleves: archive.indicateurs.eleves,
      classes: archive.classes.length,
      moyenne,
      taux_reussite: taux,
      encaisse,
      attendu: archive.indicateurs.attendu,
      impaye: archive.indicateurs.impaye,
      absences,
    },
    classes: classes.map((classe) => ({
      nom: classe.classe_nom,
      effectif: classe.effectif,
      moyenne: classe.moyenne,
      taux_reussite: classe.taux_reussite,
      encaisse: classe.encaisse,
      attendu: classe.attendu,
      impaye: classe.impaye,
      absences: classe.absences,
    })),
    trimestres: archive.trimestres.map((ligne) => ({
      trimestre: ligne.trimestre,
      moyenne: ligne.moyenne,
      taux_reussite: ligne.taux_reussite,
      encaisse: ligne.encaisse,
      absences: ligne.absences,
    })),
    decisions: {
      promus: archive.indicateurs.promus,
      redoublants: archive.indicateurs.redoublants,
      diplomes: archive.indicateurs.diplomes,
      transferes: archive.indicateurs.transferes,
    },
  };
}
