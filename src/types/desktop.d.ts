/** Types de la coque Electron exposée à la page (voir desktop/preload.js). */

export type StatutMiseAJour =
  | "inactif"
  | "verification"
  | "a-jour"
  | "disponible"
  | "telechargement"
  | "pret"
  | "erreur"
  | "indisponible";

export type EtatBureau = {
  version: string;
  packaged: boolean;
  statut: StatutMiseAJour;
  versionDisponible: string | null;
  progression: number;
  message: string;
};

export type PontBureau = {
  estBureau: true;
  etat: () => Promise<EtatBureau>;
  verifierMisesAJour: () => Promise<EtatBureau>;
  telechargerMiseAJour: () => Promise<EtatBureau>;
  installerMiseAJour: () => Promise<boolean>;
  reessayer: () => Promise<boolean>;
  ouvrirExterne: (url: string) => Promise<boolean>;
  surEtat: (rappel: (etat: EtatBureau) => void) => () => void;
};

declare global {
  interface Window {
    ecolepayDesktop?: PontBureau;
  }
}
