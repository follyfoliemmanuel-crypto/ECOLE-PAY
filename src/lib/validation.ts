"use server";
import { z } from "zod";

// ---------------------------------------------------------------------------
//  Schémas de validation de base
// ---------------------------------------------------------------------------

/** Email avec validation de base */
export const emailSchema = z.string()
  .email("Email invalide")
  .min(1, "L'email est requis")
  .max(255, "Email trop long")
  .transform(value => value.toLowerCase().trim());

/** Nom d'école valide (lettres, espaces, accents, pas de caractères spéciaux) */
export const nomEcoleSchema = z.string()
  .min(2, "Nom d'école trop court (minimum 2 caractères)")
  .max(100, "Nom d'école trop long (maximum 100 caractères)")
  .regex(/^[a-zA-ZÀ-ÿ\s\-']+$/, "Nom d'école contient des caractères invalides")
  .transform(value => value.trim());

/** Téléphone togolais valide (+228 + 8 chiffres) */
export const telephoneSchema = z.string()
  .optional()
  .refine(value => {
    if (!value || value === "" ) return true;
    return /^\+228\d{8}$/.test(value);
  }, "Format téléphone invalide. Doit être +228 suivi de 8 chiffres (ex: +2287654321)");

/** Mot de passe fort */
export const motDePasseSchema = z.string()
  .min(12, "Mot de passe trop court (minimum 12 caractères)")
  .max(128, "Mot de passe trop long (maximum 128 caractères)")
  .regex(/[A-Z]/, "Doit contenir au moins une majuscule")
  .regex(/[a-z]/, "Doit contenir au moins une minuscule")
  .regex(/[0-9]/, "Doit contenir au moins un chiffre")
  .regex(/[^A-Za-z0-9]/, "Doit contenir au moins un caractère spécial")
  .refine(value => {
    // Pas de mots de passe communes
    const commonPasswords = ["admin", "password", "123456", "hello", "demo"];
    return !commonPasswords.includes(value.toLowerCase());
  }, "Ne doit pas être un mot de passe commun");

/** Quantité positive */
export const quantiteSchema = z.number()
  .positive("Quantité doit être positive")
  .int("Quantité doit être un entier")
  .max(999, "Quantité trop grande (maximum 999)");

/** ID UUID valide */
export const uuidSchema = z.string()
  .uuid("ID invalide")
  .min(1, "ID requis");

/** Date ISO */
export const dateSchema = z.string()
  .refine(value => {
    const date = new Date(value);
    return !isNaN(date.getTime());
  }, "Date invalide");

/** Code postal numérique */
export const codePostalSchema = z.string()
  .regex(/^\d{5}$/, "Code postal doit être 5 chiffres");

// ---------------------------------------------------------------------------
//  Schémas de validation métier
// ---------------------------------------------------------------------------

/** Données complètes d'un élève */
export const formulaireEleveSchema = z.object({
  nom: z.string().min(2, "Nom trop court (minimum 2 caractères)"),
  prenom: z.string().min(2, "Prénom trop court (minimum 2 caractères)"),
  classe: z.string().min(1, "Classe requise"),
  telephoneParent: telephoneSchema.optional(),
  emailParent: emailSchema.optional(),
});

/** Données de paiement */
export const formulairePaiementSchema = z.object({
  montant: quantiteSchema,
  methodePaiement: z.enum(["ESPECES", "FLOOZ", "TMONEY"]),
  reference: z.string().optional(),
  notes: z.string().max(500, "Notes trop longues (maximum 500 caractères)").optional(),
});

/** Configuration d'école */
export const formulaireEcoleSchema = z.object({
  nom: nomEcoleSchema,
  telephone: telephoneSchema.optional(),
  adresse: z.string().max(200, "Adresse trop longue (maximum 200 caractères)").optional(),
});

/** Formulaire de connexion */
export const formulaireConnexionSchema = z.object({
  email: emailSchema,
  motDePasse: z.string().min(1, "Mot de passe requis"),
});

/** Formulaire d'inscription */
export const formulaireInscriptionSchema = z.object({
  nomEcole: nomEcoleSchema,
  emailContact: emailSchema,
  telephoneContact: telephoneSchema.optional(),
  motDePasse: motDePasseSchema,
  motDePasseConfirmation: z.string(),
}).refine(data => data.motDePasse === data.motDePasseConfirmation, {
  message: "Mots de passe ne correspondent pas",
  path: ["motDePasseConfirmation"],
});

// ---------------------------------------------------------------------------
//  Fonctions de validation utilitaires
// ---------------------------------------------------------------------------

/** Valider n'importe quel schéma et retourner les erreurs */
export function validerForm<Data, Schéma>(donnees: Data, schema: z.Schema<Schéma>): 
  | { succes: true; donnees: Schéma }
  | { succes: false; erreurs: string[] } {
  try {
    const donneesValidees = schema.parse(donnees);
    return { succes: true, donnees: donneesValidees };
  } catch (erreur) {
    if (erreur instanceof z.ZodError) {
      const messages = erreur.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      return { succes: false, erreurs: messages };
    }
    return { succes: false, erreurs: ["Validation échouée"] };
  }
}

/** Valider seulement un champ spécifique */
export function validerChamp<Schéma>(valeur: unknown, schema: z.Schema<Schéma>): 
  | { succes: true; valeur: Schéma }
  | { succes: false; erreur: string } {
  try {
    const valeurValidee = schema.parse(valeur);
    return { succes: true, valeur: valeurValidee };
  } catch (erreur) {
    if (erreur instanceof z.ZodError) {
      return { succes: false, erreur: erreur.errors[0]?.message || "Valeur invalide" };
    }
    return { succes: false, erreur: "Validation échouée" };
  }
}

/** Exécuter plusieurs validations */
export async function validerTous<
  T extends Record<string, any>,
  R extends Record<string, z.Schema<any>>
>(
  donnees: T,
  schemas: R
): Promise<
  | { succes: true; donnees: { [K in keyof R]: R[K] extends z.Schema<infer V> ? V : never } }
  | { succes: false; erreurs: Record<string, string[]> }
> {
  const resultats: Record<string, any> = {};
  const erreurs: Record<string, string[]> = {};

  for (const [cle, schema] of Object.entries(schemas)) {
    try {
      const donneesValidees = schema.parse(donnees[cle]);
      resultats[cle] = donneesValidees;
    } catch (erreur) {
      if (erreur instanceof z.ZodError) {
        erreurs[cle] = erreur.errors.map(err => err.message);
      } else {
        erreurs[cle] = ["Erreur de validation"];
      }
    }
  }

  if (Object.keys(erreurs).length > 0) {
    return { succes: false, erreurs };
  }

  return { succes: true, donnees: resultats as any };
}

/** Filtre anti-bot simple */
export function estBot(valideur: (valeur: any) => boolean): boolean {
  return !valideur;
}

export default {
  emailSchema,
  nomEcoleSchema,
  telephoneSchema,
  motDePasseSchema,
  quantiteSchema,
  uuidSchema,
  dateSchema,
  codePostalSchema,
  formulaireEleveSchema,
  formulairePaiementSchema,
  formulaireEcoleSchema,
  formulaireConnexionSchema,
  formulaireInscriptionSchema,
  validerForm,
  validerChamp,
  validerTous,
  estBot,
};