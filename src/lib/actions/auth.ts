"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, transaction, uneLigne } from "../db";
import {
  creerSession,
  creerSessionSuperAdmin,
  genererJeton,
  hacherJeton,
  hacherMotDePasse,
  supprimerSession,
  supprimerSessionSuperAdmin,
  verifierMotDePasse,
  verifierMotDePasseSuperAdmin,
} from "../auth";
import { estEmailSuperAdmin } from "../activation";
import { envoyerEmail, modeleEmailReinitialisation } from "../email";
import { normaliserTelephone, formatTelephone } from "../format";
import { anneeScolaire } from "../mois";
import {
  creerCaptcha,
  consommerLimite,
  enregistrerTentativeConnexion,
  etatLimiteConnexion,
  infosRequete,
  journaliserRefusEssai,
  messageBlocage,
  MESSAGE_CONNEXION,
  MESSAGE_ESSAI_REFUSE,
  normaliserNomEcole,
  trouverEssaiExistant,
  verifierCaptcha,
  type EssaiExistant,
} from "../securite";
import { estEmail, messageErreurBdd, texte } from "./helpers";

export type EtatAuth = {
  error?: string;
  success?: string;
  lien?: string;
  /** Captcha exigé après 3 échecs de connexion. */
  captcha?: { question: string; token: string };
} | null;

/** Motif lisible conservé dans le journal d'audit du super admin. */
function motifRefusEssai(essai: EssaiExistant, params: {
  nomNormalise: string;
  telephoneNormalise: string | null;
  whatsappNormalise: string | null;
}): string {
  if (essai.nom_normalise === params.nomNormalise) {
    return "Nom d'école déjà utilisé pour un essai gratuit.";
  }
  if (
    params.telephoneNormalise &&
    essai.telephone_normalise === params.telephoneNormalise
  ) {
    return "Numéro de téléphone déjà utilisé pour un essai gratuit.";
  }
  return "Numéro WhatsApp déjà utilisé pour un essai gratuit.";
}

// ---------------------------------------------------------------------------
//  Inscription d'une école (1 compte = 1 école)
// ---------------------------------------------------------------------------
export async function inscrire(
  _etat: EtatAuth,
  donnees: FormData,
): Promise<EtatAuth> {
  const { ip, appareil } = await infosRequete();

  // Rate limiting global côté serveur : 10 inscriptions par heure et par IP.
  if (!(await consommerLimite(`auth:inscription:ip:${ip}`, 10, 3600))) {
    return {
      error:
        "Trop de tentatives d'inscription depuis cette connexion. Réessayez dans une heure.",
    };
  }

  const nomEcole = texte(donnees, "nom_ecole");
  const nomNormalise = normaliserNomEcole(nomEcole);
  const adresse = texte(donnees, "adresse");
  const telephone = texte(donnees, "telephone");
  const whatsappSaisi = texte(donnees, "whatsapp");
  const email = texte(donnees, "email").toLowerCase();
  const motDePasse = texte(donnees, "mot_de_passe");
  const confirmation = texte(donnees, "confirmation");

  if (nomNormalise.length < 2) {
    return { error: "Indiquez le nom de votre école." };
  }
  if (!estEmail(email)) {
    return { error: "Cet email n'est pas valide." };
  }
  if (motDePasse.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (motDePasse !== confirmation) {
    return { error: "Les deux mots de passe ne sont pas identiques." };
  }

  // Le téléphone est obligatoire : c'est lui qui bloque un nouvel essai même
  // si le directeur change d'adresse email.
  const telephoneNormalise = normaliserTelephone(telephone);
  if (!telephoneNormalise) {
    return {
      error:
        "Indiquez un numéro de téléphone togolais valide (8 chiffres, ex. 90 12 34 56).",
    };
  }

  const whatsapp = whatsappSaisi || telephone;
  const whatsappNormalise = normaliserTelephone(whatsapp);
  if (!whatsappNormalise) {
    return {
      error: "Le numéro WhatsApp n'est pas valide (8 chiffres, ex. 90 12 34 56).",
    };
  }

  const identite = {
    nomNormalise,
    telephoneNormalise,
    whatsappNormalise,
  };

  // Anti-triche : un seul essai gratuit par nom d'école, téléphone ou WhatsApp.
  const essaiExistant = await trouverEssaiExistant(identite);
  if (essaiExistant) {
    await journaliserRefusEssai({
      nomEcole,
      nomNormalise,
      telephone: `+228 ${formatTelephone(telephoneNormalise)}`,
      telephoneNormalise,
      whatsapp: `+228 ${formatTelephone(whatsappNormalise)}`,
      whatsappNormalise,
      email,
      ip,
      appareil,
      motif: motifRefusEssai(essaiExistant, identite),
      essaiId: essaiExistant.id,
    });
    return { error: MESSAGE_ESSAI_REFUSE };
  }

  const dejaPrise = await uneLigne<{ existe: boolean }>(
    `select exists(
       select 1 from ecoles where lower(email) = $1
       union all
       select 1 from users where lower(email) = $1
     ) as existe`,
    [email],
  );
  if (dejaPrise?.existe) {
    return { error: "Un compte existe déjà avec cet email. Connectez-vous." };
  }

  // Logo optionnel : on limite le poids pour ne pas alourdir chaque page.
  let logo: string | null = null;
  const fichier = donnees.get("logo");
  if (fichier instanceof File && fichier.size > 0) {
    const typesAcceptes = ["image/png", "image/jpeg", "image/webp"];
    if (!typesAcceptes.includes(fichier.type)) {
      return { error: "Le logo doit être une image PNG, JPG ou WebP." };
    }
    if (fichier.size > 250_000) {
      return { error: "Le logo ne doit pas dépasser 250 Ko." };
    }
    const octets = Buffer.from(await fichier.arrayBuffer());
    logo = `data:${fichier.type};base64,${octets.toString("base64")}`;
  }

  const telephoneAffiche = `+228 ${formatTelephone(telephoneNormalise)}`;
  const whatsappAffiche = `+228 ${formatTelephone(whatsappNormalise)}`;

  try {
    const cree = await transaction(async (client) => {
      const ecole = await client.query<{ id: string }>(
        `insert into ecoles
           (nom, nom_normalise, adresse, telephone, telephone_normalise,
            whatsapp, whatsapp_normalise, email, logo_url, plan, offre, statut,
            date_fin_essai, ip_inscription, appareil_inscription)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
                 'essai', 'PREMIUM', 'ESSAI', current_date + 30, $10, $11)
         returning id`,
        [
          nomEcole,
          nomNormalise,
          adresse || null,
          telephoneAffiche,
          telephoneNormalise,
          whatsappAffiche,
          whatsappNormalise,
          email,
          logo,
          ip,
          appareil,
        ],
      );
      const ecoleId = ecole.rows[0].id;

      // Registre : l'essai est consommé au moment de la création du compte.
      // Les index uniques partiels garantissent qu'aucune course concurrente
      // ne peut créer deux essais pour la même identité.
      await client.query(
        `insert into essais_utilises
           (ecole_id, nom_ecole, nom_normalise, telephone, telephone_normalise,
            whatsapp, whatsapp_normalise, email, ip, appareil, actif)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)`,
        [
          ecoleId,
          nomEcole,
          nomNormalise,
          telephoneAffiche,
          telephoneNormalise,
          whatsappAffiche,
          whatsappNormalise,
          email,
          ip,
          appareil,
        ],
      );

      const hash = await hacherMotDePasse(motDePasse);
      const utilisateur = await client.query<{ id: string; token_version: number }>(
        `insert into users (ecole_id, nom, email, mot_de_passe, role)
         values ($1, $2, $3, $4, 'directeur')
         returning id, token_version`,
        [ecoleId, `Directeur · ${nomEcole}`, email, hash],
      );

      return {
        ecoleId,
        userId: utilisateur.rows[0].id,
        version: utilisateur.rows[0].token_version,
      };
    });

    await creerSession(cree.userId, cree.version);
  } catch (erreur) {
    const e = erreur as { code?: string; constraint?: string };

    // Course entre deux inscriptions simultanées : l'index unique a tranché.
    if (e?.code === "23505" && e.constraint?.startsWith("essais_utilises")) {
      const existant = await trouverEssaiExistant(identite);
      await journaliserRefusEssai({
        nomEcole,
        nomNormalise,
        telephone: telephoneAffiche,
        telephoneNormalise,
        whatsapp: whatsappAffiche,
        whatsappNormalise,
        email,
        ip,
        appareil,
        motif: "Essai déjà accordé (tentative simultanée).",
        essaiId: existant?.id ?? null,
      });
      return { error: MESSAGE_ESSAI_REFUSE };
    }

    return { error: messageErreurBdd(erreur) };
  }

  revalidatePath("/", "layout");
  redirect("/app");
}

// ---------------------------------------------------------------------------
//  Connexion (anti-brute-force côté serveur)
// ---------------------------------------------------------------------------
export async function connecter(
  _etat: EtatAuth,
  donnees: FormData,
): Promise<EtatAuth> {
  // Le champ accepte l'email du directeur ou l'identifiant donné au professeur
  // (ex. « koffi123 »). Les deux passent par la même vérification.
  const email = texte(donnees, "email").toLowerCase().slice(0, 160);
  const motDePasse = texte(donnees, "mot_de_passe");
  const { ip, appareil } = await infosRequete();

  // Rate limiting global : 40 tentatives par 10 minutes et par IP.
  if (!(await consommerLimite(`auth:connexion:ip:${ip}`, 40, 600))) {
    await enregistrerTentativeConnexion({
      email,
      ip,
      appareil,
      succes: false,
      bloque: true,
    });
    return {
      error: "Trop de tentatives depuis cette connexion. Patientez quelques minutes.",
    };
  }

  if (email.length < 3 || !motDePasse) {
    return {
      error: "Renseignez votre identifiant (ou email) et votre mot de passe.",
    };
  }

  const etat = await etatLimiteConnexion(email, ip);

  // Blocage progressif : 5 échecs → 15 min, 10 échecs → 1 heure.
  if (etat.bloqueJusqua) {
    await enregistrerTentativeConnexion({
      email,
      ip,
      appareil,
      succes: false,
      bloque: true,
    });
    return { error: messageBlocage(etat.bloqueJusqua) };
  }

  // Captcha obligatoire dès le 3e échec, avant même de vérifier le mot de passe.
  if (etat.exigerCaptcha) {
    const jeton = texte(donnees, "captcha_token");
    const reponse = texte(donnees, "captcha_reponse");
    if (!verifierCaptcha(jeton, reponse)) {
      await enregistrerTentativeConnexion({
        email,
        ip,
        appareil,
        succes: false,
      });
      return {
        error: MESSAGE_CONNEXION,
        captcha: creerCaptcha(),
      };
    }
  }

  // Le captcha est renvoyé au formulaire tant que le seuil de 3 échecs est
  // atteint, pour l'essai suivant.
  const captchaSuivant = (echecs: number) =>
    echecs + 1 >= 3 ? creerCaptcha() : undefined;

  // Le compte super admin n'est pas un utilisateur d'école : il vit uniquement
  // en variable d'environnement et n'ouvre que la page /super-admin.
  if (estEmailSuperAdmin(email)) {
    if (!verifierMotDePasseSuperAdmin(motDePasse)) {
      await enregistrerTentativeConnexion({
        email,
        ip,
        appareil,
        succes: false,
      });
      return {
        error: MESSAGE_CONNEXION,
        captcha: captchaSuivant(etat.echecs),
      };
    }

    await enregistrerTentativeConnexion({
      email,
      ip,
      appareil,
      succes: true,
    });
    await creerSessionSuperAdmin();
    revalidatePath("/", "layout");
    redirect("/super-admin");
  }

  const utilisateur = await uneLigne<{
    id: string;
    mot_de_passe: string;
    actif: boolean;
    token_version: number;
    role: string;
    ecole_active: boolean;
  }>(
    `select u.id, u.mot_de_passe, u.actif, u.token_version, u.role,
            e.actif as ecole_active
       from users u
       join ecoles e on e.id = u.ecole_id
      where lower(u.email) = $1 or lower(u.identifiant) = $1
      limit 1`,
    [email],
  );

  // Email inconnu, compte désactivé ou école désactivée : même message.
  if (!utilisateur || !utilisateur.actif || !utilisateur.ecole_active) {
    await enregistrerTentativeConnexion({
      email,
      ip,
      appareil,
      succes: false,
    });
    return {
      error: MESSAGE_CONNEXION,
      captcha: captchaSuivant(etat.echecs),
    };
  }

  const valide = await verifierMotDePasse(motDePasse, utilisateur.mot_de_passe);
  if (!valide) {
    await enregistrerTentativeConnexion({
      email,
      ip,
      appareil,
      succes: false,
    });
    return {
      error: MESSAGE_CONNEXION,
      captcha: captchaSuivant(etat.echecs),
    };
  }

  await sql(
    `update users
        set derniere_connexion = now(),
            derniere_activite = now()
      where id = $1`,
    [utilisateur.id],
  );
  await enregistrerTentativeConnexion({
    email,
    ip,
    appareil,
    succes: true,
  });
  await creerSession(utilisateur.id, utilisateur.token_version);

  revalidatePath("/", "layout");
  // Le professeur arrive directement sur son espace de saisie ; le personnel
  // administratif sur le tableau de bord.
  redirect(utilisateur.role === "prof" ? "/prof" : "/app");
}

// ---------------------------------------------------------------------------
//  Déconnexion
// ---------------------------------------------------------------------------
export async function deconnecter(): Promise<void> {
  await supprimerSession();
  redirect("/connexion");
}

/** Ferme uniquement la session super admin, sans toucher au compte école. */
export async function deconnecterSuperAdmin(): Promise<void> {
  await supprimerSessionSuperAdmin();
  redirect("/connexion");
}

// ---------------------------------------------------------------------------
//  Mot de passe oublié
// ---------------------------------------------------------------------------
export async function demanderReinitialisation(
  _etat: EtatAuth,
  donnees: FormData,
): Promise<EtatAuth> {
  const email = texte(donnees, "email").toLowerCase();
  if (!estEmail(email)) return { error: "Cet email n'est pas valide." };

  const { ip } = await infosRequete();

  // Rate limiting serveur : par IP et par email.
  if (!(await consommerLimite(`auth:reset:ip:${ip}`, 20, 3600))) {
    return { error: "Trop de demandes. Patientez quelques minutes." };
  }
  if (!(await consommerLimite(`auth:reset:email:${email}`, 4, 900))) {
    return { error: "Trop de demandes. Patientez quelques minutes." };
  }

  const message =
    "Si un compte correspond à cet email, vous recevrez un lien de réinitialisation dans quelques instants.";

  const utilisateur = await uneLigne<{ id: string; nom: string }>(
    `select id, nom from users where lower(email) = $1 and actif = true`,
    [email],
  );
  if (!utilisateur) return { success: message };

  const jeton = genererJeton();
  const expire = new Date(Date.now() + 60 * 60 * 1000);

  await sql(`delete from password_resets where user_id = $1 and utilise = false`, [
    utilisateur.id,
  ]);
  await sql(
    `insert into password_resets (user_id, token_hash, expire_le)
     values ($1, $2, $3)`,
    [utilisateur.id, hacherJeton(jeton), expire],
  );

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const lien = `${base}/reinitialiser?jeton=${jeton}`;

  await envoyerEmail({
    to: email,
    subject: "Réinitialisation de votre mot de passe — ECOLE PAY",
    html: modeleEmailReinitialisation(lien, utilisateur.nom),
  });

  // En développement, le lien est affiché pour pouvoir tester sans email.
  return {
    success: message,
    lien: process.env.NODE_ENV !== "production" ? lien : undefined,
  };
}

// ---------------------------------------------------------------------------
//  Définition d'un nouveau mot de passe
// ---------------------------------------------------------------------------
export async function reinitialiserMotDePasse(
  _etat: EtatAuth,
  donnees: FormData,
): Promise<EtatAuth> {
  const jeton = texte(donnees, "jeton");
  const motDePasse = texte(donnees, "mot_de_passe");
  const confirmation = texte(donnees, "confirmation");

  const { ip } = await infosRequete();
  if (!(await consommerLimite(`auth:nouveau-mdp:ip:${ip}`, 10, 3600))) {
    return { error: "Trop de tentatives. Patientez quelques minutes." };
  }

  if (motDePasse.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }
  if (motDePasse !== confirmation) {
    return { error: "Les deux mots de passe ne sont pas identiques." };
  }

  const ligne = await uneLigne<{ id: string; user_id: string }>(
    `select id, user_id
       from password_resets
      where token_hash = $1
        and utilise = false
        and expire_le > now()`,
    [hacherJeton(jeton)],
  );

  if (!ligne) {
    return {
      error:
        "Ce lien est invalide ou a expiré. Demandez un nouveau lien de réinitialisation.",
    };
  }

  const hash = await hacherMotDePasse(motDePasse);
  await transaction(async (client) => {
    await client.query(
      `update users
          set mot_de_passe = $1,
              token_version = token_version + 1
        where id = $2`,
      [hash, ligne.user_id],
    );
    await client.query(
      `update password_resets set utilise = true where user_id = $1 and utilise = false`,
      [ligne.user_id],
    );
  });

  await supprimerSession();
  redirect("/connexion?reinitialise=1");
}

/** Utilisé par la page d'inscription : l'année scolaire est gérée côté serveur. */
export async function anneeCourante(): Promise<string> {
  return anneeScolaire();
}
