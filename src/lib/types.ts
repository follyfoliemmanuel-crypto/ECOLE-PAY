export type Role = "directeur" | "secretaire" | "comptable" | "prof";
/** Offre commerciale active. L'essai donne temporairement accès à PREMIUM. */
export type Offre = "STARTER" | "STANDARD" | "PREMIUM";
/** Plan enregistré dans la table `subscriptions` (minuscules). */
export type PlanAbo = "starter" | "standard" | "premium";
/** Statut d'un abonnement dans `subscriptions`. */
export type StatutAbo = "active" | "blocked";
/** @deprecated Ancien modèle de formules, conservé uniquement pour les migrations SQL. */
export type Plan = "essai" | "petite" | "moyenne" | "grosse";
export type StatutEcole = "ESSAI" | "ACTIF" | "BLOQUE";
/** Pourquoi une école est en lecture seule (null = modifications permises). */
export type MotifLectureSeule =
  | "ESSAI_TERMINE"
  | "ABONNEMENT_TERMINE"
  | "BLOQUE";
export type StatutFrais = "PAYE" | "PARTIEL" | "NON_PAYE";
export type ModePaiement = "ESPECES" | "FLOOZ" | "TMONEY";
/** Un élève n'est jamais supprimé : il sort par transfert ou diplôme. */
export type StatutEleve = "actif" | "inactif" | "transfere" | "diplome";
export type StatutInscription =
  | "INSCRIT"
  | "PROMU"
  | "REDOUBLANT"
  | "TRANSFERE"
  | "DIPLOME"
  | "INACTIF";
export type DecisionFinAnnee =
  | "PASSE"
  | "REDOUBLE"
  | "DIPLOME"
  | "TRANSFERE"
  | "INACTIF"
  | "ADMIS"
  | "ECHOUE";

/** Rythme de paiement choisi par la classe. */
export type Frequence = "MENSUEL" | "TRANCHES" | "ANNUEL";

/** Une tranche libre définie par la classe (nom, montant, date limite). */
export type Tranche = {
  id: string;
  classe_id: string;
  ordre: number;
  nom: string;
  montant: number;
  /** Date limite au format ISO (AAAA-MM-JJ), ou null. */
  date_limite: string | null;
};

/** Nature d'une échéance : la scolarité ou les frais d'entrée. */
export type TypeFrais = "SCOLARITE" | "INSCRIPTION" | "REINSCRIPTION";

export type Ecole = {
  id: string;
  nom: string;
  /** Identifiant public du portail parent : /parent/{slug}. */
  slug: string;
  adresse: string | null;
  telephone: string | null;
  email: string;
  logo_url: string | null;
  offre: Offre;
  statut: StatutEcole;
  date_fin_essai: string | null;
  date_fin_abonnement: string | null;
  actif: boolean;
  recu_compteur: number;
  modele_recu: string;
  modele_relance: string;
};

/** Abonnement mensuel courant d'une école (table `subscriptions`). */
export type AbonnementEcole = {
  plan: Offre;
  statut: StatutAbo;
  /** Premier jour couvert (AAAA-MM-JJ). */
  dateDebut: string;
  /** Dernier jour couvert (AAAA-MM-JJ). */
  dateFin: string;
  /** Date du dernier paiement reçu, ou null. */
  dernierPaiement: string | null;
  montant: number;
  moisPayes: number;
};

export type Session = {
  userId: string;
  ecoleId: string;
  role: Role;
  nom: string;
  /** Email du compte. Un professeur peut se connecter par identifiant sans email. */
  email: string | null;
  /** Identifiant de connexion (professeurs), sinon null. */
  identifiant: string | null;
  /** Fiche professeur liée au compte (role = prof), sinon null. */
  profId: string | null;
  ecole: {
    id: string;
    nom: string;
    logoUrl: string | null;
    offre: Offre;
    statut: StatutEcole;
    dateFinEssai: string | null;
    dateFinAbonnement: string | null;
    /** Abonnement mensuel courant, ou null pour une école en essai. */
    abonnement: AbonnementEcole | null;
    /** Vrai quand le paiement du mois n'est pas reçu : consultation seule. */
    lectureSeule: boolean;
    /** Raison de la lecture seule, null quand les modifications sont permises. */
    motifLectureSeule: MotifLectureSeule | null;
  };
};

export type Classe = {
  id: string;
  nom: string;
  /** Tarif d'un mois ou de l'année (0 pour une classe en tranches). */
  montant_periode: number;
  frequence_paiement: Frequence;
  frais_inscription: number;
  frais_reinscription: number;
  nb_eleves: number;
  /** Tranches libres, dans l'ordre (vide pour mensuel / annuel). */
  tranches?: Tranche[];
  /** NORMALE = promotion automatique, EXAMEN = décision du directeur. */
  type_fin: TypeFinClasse;
  /** Examen national préparé (CEPD, BEPC, BAC), pour une classe d'examen. */
  examen: ExamenNational | null;
  /** Classe d'accueil après réussite. null = fin de cycle (diplôme). */
  classe_suivante_id: string | null;
  /** Nom de la classe suivante, pour l'affichage. */
  classe_suivante_nom?: string | null;
};

export type TypeFinClasse = "NORMALE" | "EXAMEN";
export type ExamenNational = "CEPD" | "BEPC" | "BAC";

export type Eleve = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F" | null;
  classe_id: string;
  classe_nom: string;
  montant_periode: number;
  frequence_paiement: Frequence;
  nom_parent: string;
  telephone_parent: string;
  annee_scolaire: string;
  type_inscription: "NOUVEAU" | "ANCIEN";
  statut: StatutEleve;
  /** Date de sortie (transfert ou diplôme), au format ISO. */
  date_sortie: string | null;
  /** Nouvelle école, pour un élève transféré. */
  ecole_destination: string | null;
  date_inscription: string;
  /** Élève masqué du portail parent par le directeur. */
  masque_portail: boolean;
  /** Photo facultative (URL ou data:image). */
  photo_url: string | null;
};

/** Élève + sa situation pour la période sélectionnée + son inscription. */
export type EleveAvecPeriode = Eleve & {
  frais_id: string | null;
  libelle?: string | null;
  montant_du: number | null;
  montant_paye: number | null;
  reste: number | null;
  statut_periode: StatutFrais | null;
  inscription_id: string | null;
  inscription_type: TypeFrais | null;
  inscription_du: number | null;
  inscription_paye: number | null;
  inscription_reste: number | null;
  inscription_statut: StatutFrais | null;
};

/** Élève proposé dans la recherche d'encaissement. */
export type EleveOption = {
  id: string;
  nom: string;
  prenom: string;
  classe_nom: string;
  nom_parent: string;
  telephone_parent: string;
};

/** Une échéance (scolarité d'un mois / d'une tranche, ou frais d'entrée). */
export type FraisPeriode = {
  id: string;
  eleve_id: string;
  type_frais: TypeFrais;
  frequence_paiement: Frequence;
  periode: number;
  tranche_id: string | null;
  libelle: string | null;
  montant_du: number;
  montant_paye: number;
  reste: number;
  statut: StatutFrais;
};

/** Élève + toutes ses échéances, chargé à la sélection dans le paiement. */
export type ElevePaiement = EleveOption & {
  classe_id: string;
  frequence_paiement: Frequence;
  frais: FraisPeriode[];
};

/** @deprecated Conservé pour les écrans qui parlaient encore de « mois ». */
export type MoisFrais = FraisPeriode;

export type Frais = FraisPeriode;

export type Paiement = {
  id: string;
  numero_recu: string;
  montant: number;
  mode_paiement: ModePaiement;
  date_paiement: string;
  annule: boolean;
  reste_apres: number;
  motif_annulation?: string | null;
  annule_par_nom?: string | null;
  annule_le?: string | null;
  eleve_id: string;
  frais_id: string;
  eleve_nom: string;
  eleve_prenom: string;
  classe_nom: string;
  type_frais: TypeFrais;
  frequence_paiement: Frequence;
  periode: number;
  tranche_id?: string | null;
  libelle: string | null;
  montant_du: number;
  reste: number;
  enregistre_par_nom: string | null;
};

export type ResultatAction = {
  ok?: boolean;
  error?: string;
  success?: string;
  redirect?: string;
};

// ---------------------------------------------------------------------------
//  Notes & bulletins
// ---------------------------------------------------------------------------
export type Matiere = {
  id: string;
  nom: string;
  coefficient: number;
};

/** Trimestre du bulletin (1 à 3). */
export type Trimestre = 1 | 2 | 3;

/** Notes d'un élève indexées par identifiant de matière. */
export type NotesEleve = Record<string, number | null>;

export type LigneBulletin = {
  matiere_id: string;
  nom: string;
  coefficient: number;
  /** Moyenne de la matière (moyenne des évaluations saisies). */
  note: number | null;
  /** Évaluations détaillées, publiées par le professeur. */
  devoir1: number | null;
  devoir2: number | null;
  composition: number | null;
  /** note × coefficient, ou null si la matière n'est pas notée. */
  points: number | null;
  appreciation: string | null;
};

export type BulletinEleve = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F" | null;
  lignes: LigneBulletin[];
  total_coefficients: number;
  total_points: number;
  moyenne: number | null;
  rang: number | null;
  mention: string;
};

export type BulletinClasse = {
  classe: { id: string; nom: string };
  ecole: {
    nom: string;
    adresse: string | null;
    telephone: string | null;
    logo_url: string | null;
  };
  annee: string;
  trimestre: Trimestre;
  matieres: Matiere[];
  eleves: BulletinEleve[];
  moyenne_classe: number | null;
  meilleure_moyenne: number | null;
  plus_faible_moyenne: number | null;
};

// ---------------------------------------------------------------------------
//  Profs & salaires
// ---------------------------------------------------------------------------
export type Prof = {
  id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  email: string | null;
  matiere: string | null;
  classes_assurees: string | null;
  salaire_mensuel: number;
  date_embauche: string | null;
  actif: boolean;
  notes: string | null;
  /** Compte de connexion lié, s'il a été créé par le directeur. */
  user_id: string | null;
  identifiant: string | null;
  compte_actif: boolean | null;
};

export type SalaireMois = {
  prof_id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  salaire_mensuel: number;
  salaire_id: string | null;
  montant_du: number;
  montant_paye: number;
  reste: number;
  statut: StatutFrais | "NON_PREPARE";
};

export type VersementSalaire = {
  id: string;
  salaire_id: string;
  prof_id: string;
  prof_nom: string;
  prof_prenom: string;
  annee: number;
  mois: number;
  montant: number;
  mode_paiement: ModePaiement;
  date_versement: string;
  observation: string | null;
  enregistre_par_nom: string | null;
};

// ---------------------------------------------------------------------------
//  Saisie des notes par les professeurs
// ---------------------------------------------------------------------------
export type StatutSaisie = "EN_COURS" | "ENVOYE" | "VALIDE" | "LIBERE";

export type SaisieNotes = {
  id: string;
  annee_scolaire: string;
  trimestre: Trimestre;
  classe_id: string;
  classe_nom: string;
  matiere_id: string;
  matiere_nom: string;
  prof_id: string | null;
  prof_nom: string | null;
  prof_prenom: string | null;
  statut: StatutSaisie;
  envoye_le: string | null;
  valide_le: string | null;
  libere_le: string | null;
  motif_liberation: string | null;
  nb_notes: number;
  updated_at: string;
};

/** Une ligne du tableau de saisie : un élève et ses trois évaluations. */
export type LigneSaisieNotes = {
  eleve_id: string;
  nom: string;
  prenom: string;
  devoir1: number | null;
  devoir2: number | null;
  composition: number | null;
};

/** Suivi d'un professeur pour le trimestre (retard, envois, validations). */
export type SuiviProf = {
  prof_id: string;
  nom: string;
  prenom: string;
  telephone: string | null;
  identifiant: string | null;
  compte_actif: boolean | null;
  en_cours: number;
  envoyes: number;
  valides: number;
  dernier_envoi: string | null;
};

/** Données renvoyées à l'écran après un encaissement réussi. */
export type PaiementEnregistre = {
  id: string;
  numero_recu: string;
  montant: number;
  reste: number;
  type_frais: TypeFrais;
  frequence_paiement: Frequence;
  periode: number;
  /** Libellé figé de l'échéance (« 1ère tranche », « Octobre »…). */
  libelle: string;
  eleve: string;
  classe: string;
  parent: string;
  telephone: string;
  ecole: string;
  date: string;
  mode: ModePaiement;
};

export type ResultatPaiement = {
  ok?: boolean;
  error?: string;
  paiement?: PaiementEnregistre;
  urlWhatsApp?: string;
};

export const LIBELLES_MODE: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  FLOOZ: "Flooz",
  TMONEY: "TMoney",
};

export const LIBELLES_STATUT: Record<StatutFrais, string> = {
  PAYE: "Payé",
  PARTIEL: "Partiel",
  NON_PAYE: "Non payé",
};

export const LIBELLES_OFFRE: Record<Offre, string> = {
  STARTER: "STARTER",
  STANDARD: "STANDARD",
  PREMIUM: "PREMIUM",
};

export const LIBELLES_ROLE: Record<Role, string> = {
  directeur: "Directeur",
  comptable: "Comptable",
  secretaire: "Secrétaire",
  prof: "Professeur",
};

export const LIBELLES_STATUT_SAISIE: Record<StatutSaisie, string> = {
  EN_COURS: "En cours",
  ENVOYE: "Envoyé",
  VALIDE: "Validé",
  LIBERE: "Libéré",
};

export const LIBELLES_STATUT_ECOLE: Record<StatutEcole, string> = {
  ESSAI: "Essai",
  ACTIF: "Active",
  BLOQUE: "Bloquée",
};

export const LIBELLES_STATUT_ELEVE: Record<StatutEleve, string> = {
  actif: "Actif",
  inactif: "Inactif",
  transfere: "Transféré",
  diplome: "Diplômé",
};

export const LIBELLES_STATUT_INSCRIPTION: Record<StatutInscription, string> = {
  INSCRIT: "Inscrit",
  PROMU: "Promu",
  REDOUBLANT: "Redoublant",
  TRANSFERE: "Transfert",
  DIPLOME: "Diplômé",
  INACTIF: "Inactif",
};

export const LIBELLES_DECISION: Record<DecisionFinAnnee, string> = {
  PASSE: "Passe",
  REDOUBLE: "Redouble",
  DIPLOME: "Diplômé",
  TRANSFERE: "Transféré",
  INACTIF: "Inactif",
  ADMIS: "Admis à l'examen",
  ECHOUE: "Échoué à l'examen",
};

// ---------------------------------------------------------------------------
//  Années scolaires, inscriptions, absences et rapports
// ---------------------------------------------------------------------------
export type AnneeScolaire = {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: "OUVERTE" | "CLOTUREE";
  cloturee_le: string | null;
  nb_eleves: number;
  nb_sortis: number;
};

export type Inscription = {
  id: string;
  eleve_id: string;
  annee_scolaire: string;
  classe_id: string;
  classe_nom: string;
  type_inscription: "NOUVEAU" | "ANCIEN";
  statut: StatutInscription;
  decision: DecisionFinAnnee | null;
  moyenne_annuelle: number | null;
  date_inscription: string;
  date_sortie: string | null;
  ecole_destination: string | null;
};

export type Absence = {
  id: string;
  eleve_id: string;
  nom: string;
  prenom: string;
  date_absence: string;
  trimestre: number | null;
  motif: string | null;
  justifiee: boolean;
};

export type TypeRapport = "TRIMESTRIEL" | "ANNUEL";
export type StatutRapport = "EN_ATTENTE" | "EN_COURS" | "PRET" | "ECHEC";

export type Rapport = {
  id: string;
  annee_scolaire: string;
  type: TypeRapport;
  trimestre: number;
  statut: StatutRapport;
  erreur: string | null;
  date_creation: string;
  date_generation: string | null;
};
