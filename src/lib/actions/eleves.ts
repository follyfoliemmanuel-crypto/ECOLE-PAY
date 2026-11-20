"use server";

import { revalidatePath } from "next/cache";
import { sql, transaction, uneLigne } from "../db";
import { getSession, refusEcriture } from "../auth";
import { anneeActive } from "../data/annees";
import { normaliserTelephone } from "../format";
import { compterElevesActifs, limitesOffre } from "../data/ecole";
import { offreEffective } from "../offres";
import { estUuid, messageErreurBdd, texte } from "./helpers";
import type { ResultatAction, StatutEleve } from "../types";

function validerChamps(donnees: FormData): {
  error?: string;
  valeurs?: {
    nom: string;
    prenom: string;
    sexe: "M" | "F" | null;
    classeId: string;
    nomParent: string;
    telephone: string;
    typeInscription: "NOUVEAU" | "ANCIEN";
  };
} {
  const nom = texte(donnees, "nom");
  const prenom = texte(donnees, "prenom");
  const sexeBrut = texte(donnees, "sexe");
  const classeId = texte(donnees, "classe_id");
  const nomParent = texte(donnees, "nom_parent");
  const telephoneSaisi = texte(donnees, "telephone_parent");
  const typeInscription =
    texte(donnees, "type_inscription") === "ANCIEN" ? "ANCIEN" : "NOUVEAU";

  if (nom.length < 2) return { error: "Indiquez le nom de l'élève." };
  if (prenom.length < 2) return { error: "Indiquez le prénom de l'élève." };
  if (sexeBrut !== "M" && sexeBrut !== "F") {
    return { error: "Choisissez le sexe de l'élève." };
  }
  if (!estUuid(classeId)) return { error: "Choisissez une classe." };
  if (nomParent.length < 2) {
    return { error: "Indiquez le nom du parent (ou du tuteur)." };
  }

  const telephone = normaliserTelephone(telephoneSaisi);
  if (!telephone) {
    return {
      error:
        "Le numéro WhatsApp du parent doit être un numéro togolais à 8 chiffres (70-73, 78-79, 90-93, 96-99).",
    };
  }

  return {
    valeurs: {
      nom,
      prenom,
      sexe: sexeBrut,
      classeId,
      nomParent,
      telephone,
      typeInscription,
    },
  };
}

async function classeValide(ecoleId: string, classeId: string): Promise<boolean> {
  const ligne = await uneLigne<{ id: string }>(
    `select id from classes where id = $1 and ecole_id = $2`,
    [classeId, ecoleId],
  );
  return Boolean(ligne);
}

const TYPES_PHOTO = ["image/png", "image/jpeg", "image/webp"];
const PHOTO_MAX = 200_000;

/**
 * Photo facultative de l'élève, stockée en data URL (comme le logo de l'école).
 * `url: undefined` = ne rien changer, `url: null` = supprimer la photo.
 */
async function lirePhoto(
  donnees: FormData,
): Promise<{ url?: string | null; error?: string }> {
  if (texte(donnees, "supprimer_photo") === "1") return { url: null };

  const fichier = donnees.get("photo");
  if (!(fichier instanceof File) || fichier.size === 0) return {};

  if (!TYPES_PHOTO.includes(fichier.type)) {
    return { error: "La photo doit être une image PNG, JPG ou WebP." };
  }
  if (fichier.size > PHOTO_MAX) {
    return { error: "La photo ne doit pas dépasser 200 Ko." };
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  return { url: `data:${fichier.type};base64,${octets.toString("base64")}` };
}

// ---------------------------------------------------------------------------
//  Ajouter un élève (directeur et secrétaire)
// ---------------------------------------------------------------------------
export async function creerEleve(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };

  const validation = validerChamps(donnees);
  if (!validation.valeurs) return { error: validation.error };
  const v = validation.valeurs;

  const photo = await lirePhoto(donnees);
  if (photo.error) return { error: photo.error };

  if (!(await classeValide(session.ecoleId, v.classeId))) {
    return { error: "Classe introuvable dans votre école." };
  }

  const annee = await anneeActive(session.ecoleId);
  const limite = limitesOffre(offreEffective(session.ecole));
  const effectif = await compterElevesActifs(session.ecoleId, annee);
  if (limite.eleves !== null && effectif >= limite.eleves) {
    return {
      error: `Votre offre ${offreEffective(session.ecole)} est limitée à ${limite.eleves} élèves. Contactez SCHOOL PAY pour passer à une offre supérieure.`,
    };
  }

  try {
    await sql(
      `insert into eleves
         (ecole_id, classe_id, nom, prenom, sexe, nom_parent,
          telephone_parent, annee_scolaire, type_inscription, photo_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        session.ecoleId,
        v.classeId,
        v.nom,
        v.prenom,
        v.sexe,
        v.nomParent,
        v.telephone,
        annee,
        v.typeInscription,
        photo.url ?? null,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/eleves");
  revalidatePath("/app");
  return {
    success:
      v.typeInscription === "ANCIEN"
        ? `${v.prenom} ${v.nom} a été ajouté. Ses échéances de scolarité sont prêtes : un ancien élève ne paie pas de frais d'inscription.`
        : `${v.prenom} ${v.nom} a été ajouté. Ses échéances et ses frais d'inscription sont prêts.`,
  };
}

// ---------------------------------------------------------------------------
//  Modifier un élève
// ---------------------------------------------------------------------------
export async function modifierEleve(
  _etat: ResultatAction | null,
  donnees: FormData,
): Promise<ResultatAction> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };

  const id = texte(donnees, "id");
  if (!estUuid(id)) return { error: "Élève introuvable." };

  const validation = validerChamps(donnees);
  if (!validation.valeurs) return { error: validation.error };
  const v = validation.valeurs;

  const photo = await lirePhoto(donnees);
  if (photo.error) return { error: photo.error };

  if (!(await classeValide(session.ecoleId, v.classeId))) {
    return { error: "Classe introuvable dans votre école." };
  }

  const eleve = await uneLigne<{ id: string; statut: StatutEleve }>(
    `select id, statut from eleves where id = $1 and ecole_id = $2`,
    [id, session.ecoleId],
  );
  if (!eleve) return { error: "Élève introuvable." };
  if (eleve.statut !== "actif") {
    return {
      error:
        "Cet élève est sorti de l'école (transfert, diplôme ou inactivité). Sa fiche est conservée en lecture seule dans l'archive.",
    };
  }

  try {
    const changementPhoto = photo.url !== undefined;
    await sql(
      `update eleves
          set nom = $1, prenom = $2, sexe = $3, classe_id = $4,
              nom_parent = $5, telephone_parent = $6, type_inscription = $7,
              photo_url = case when $10 then $11::text else photo_url end
        where id = $8 and ecole_id = $9`,
      [
        v.nom,
        v.prenom,
        v.sexe,
        v.classeId,
        v.nomParent,
        v.telephone,
        v.typeInscription,
        id,
        session.ecoleId,
        changementPhoto,
        photo.url ?? null,
      ],
    );
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/eleves");
  revalidatePath(`/app/eleves/${id}`);
  revalidatePath("/app");
  return { success: "Les informations de l'élève ont été mises à jour." };
}

// ---------------------------------------------------------------------------
//  Un élève n'est jamais supprimé : il sort par transfert ou diplôme.
//  Voir `transfererEleve` dans src/lib/actions/annees.ts.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
//  Importer des élèves en lot (CSV / Excel)
// ---------------------------------------------------------------------------
export type EleveImportDonnee = {
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  classeId: string;
  nomParent: string;
  telephoneParent: string;
  typeInscription?: "NOUVEAU" | "ANCIEN";
};

export type ResultatImport = {
  success?: string;
  error?: string;
  importes?: number;
};

export async function importerEleves(
  eleves: EleveImportDonnee[],
): Promise<ResultatImport> {
  const session = await getSession();
  if (!session) return { error: "Votre session a expiré." };
  const refusAbo = refusEcriture(session);
  if (refusAbo) return { error: refusAbo };

  if (!Array.isArray(eleves) || eleves.length === 0) {
    return { error: "Aucun élève à importer." };
  }
  if (eleves.length > 500) {
    return {
      error:
        "Un import est limité à 500 élèves à la fois. Découpez votre fichier en plusieurs parties.",
    };
  }

  const annee = await anneeActive(session.ecoleId);
  const limite = limitesOffre(offreEffective(session.ecole));
  const effectif = await compterElevesActifs(session.ecoleId, annee);
  if (limite.eleves !== null && effectif + eleves.length > limite.eleves) {
    return {
      error: `Votre offre ${offreEffective(session.ecole)} est limitée à ${limite.eleves} élèves (actuellement ${effectif}). L'import de ${eleves.length} élèves dépasserait cette limite.`,
    };
  }

  const classesIds = Array.from(new Set(eleves.map((e) => e.classeId)));
  for (const cId of classesIds) {
    if (!estUuid(cId) || !(await classeValide(session.ecoleId, cId))) {
      return { error: "Une ou plusieurs classes sélectionnées sont introuvables." };
    }
  }

  const lignesValides: {
    nom: string;
    prenom: string;
    sexe: "M" | "F";
    classeId: string;
    nomParent: string;
    telephone: string;
    typeInscription: "NOUVEAU" | "ANCIEN";
  }[] = [];

  for (let i = 0; i < eleves.length; i++) {
    const e = eleves[i];
    const nom = (e.nom ?? "").trim();
    const prenom = (e.prenom ?? "").trim();
    const sexe = e.sexe === "F" ? "F" : "M";
    const nomParent = (e.nomParent ?? "").trim();
    const telephone = normaliserTelephone(e.telephoneParent);
    const typeInscription = e.typeInscription === "ANCIEN" ? "ANCIEN" : "NOUVEAU";

    if (nom.length < 2 || prenom.length < 2) {
      return {
        error: `Ligne ${i + 1} : Le nom et le prénom doivent faire au moins 2 caractères (${prenom} ${nom}).`,
      };
    }
    if (nom.length > 80 || prenom.length > 80 || nomParent.length > 120) {
      return {
        error: `Ligne ${i + 1} : Un des champs dépasse la longueur autorisée (80 caractères pour les noms, 120 pour le parent).`,
      };
    }
    if (nomParent.length < 2) {
      return {
        error: `Ligne ${i + 1} : Le nom du parent de ${prenom} ${nom} est requis.`,
      };
    }
    if (!telephone) {
      return {
        error: `Ligne ${i + 1} : Le numéro du parent de ${prenom} ${nom} (${e.telephoneParent}) n'est pas un numéro togolais valide à 8 chiffres (70-73, 78-79, 90-93, 96-99).`,
      };
    }

    lignesValides.push({
      nom,
      prenom,
      sexe,
      classeId: e.classeId,
      nomParent,
      telephone,
      typeInscription,
    });
  }

  try {
    await transaction(async (client) => {
      for (const e of lignesValides) {
        await client.query(
          `insert into eleves
             (ecole_id, classe_id, nom, prenom, sexe, nom_parent,
              telephone_parent, annee_scolaire, type_inscription)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            session.ecoleId,
            e.classeId,
            e.nom,
            e.prenom,
            e.sexe,
            e.nomParent,
            e.telephone,
            annee,
            e.typeInscription,
          ],
        );
      }
    });
  } catch (erreur) {
    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/app/eleves");
  revalidatePath("/app");
  return {
    success: `${lignesValides.length} élève${lignesValides.length > 1 ? "s ont été importés" : " a été importé"} avec succès. Les échéances et les frais d'inscription sont immédiatement prêts.`,
    importes: lignesValides.length,
  };
}
