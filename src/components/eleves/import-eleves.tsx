"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { importerEleves, type EleveImportDonnee } from "@/lib/actions/eleves";
import { normaliserTelephone, formatTelephone } from "@/lib/format";
import { Bouton } from "@/components/ui/button";
import { Alerte } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";

type ClasseOption = {
  id: string;
  nom: string;
};

type LigneParsed = {
  id: string;
  nom: string;
  prenom: string;
  sexe: "M" | "F";
  nomParent: string;
  telephoneParentBrut: string;
  telephoneParent: string | null;
  classeNom?: string;
  classeId?: string;
  erreur?: string;
};

export function ImportEleves({ classes }: { classes: ClasseOption[] }) {
  const router = useRouter();
  const [classeDefaut, setClasseDefaut] = useState<string>(classes[0]?.id ?? "");
  const [typeInscription, setTypeInscription] = useState<"NOUVEAU" | "ANCIEN">(
    "NOUVEAU",
  );
  const [texteColle, setTexteColle] = useState("");
  const [nomFichier, setNomFichier] = useState<string | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);
  const [succesGlobal, setSuccesGlobal] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const redirection = useRef<number | null>(null);

  // La redirection différée après un import réussi ne doit pas s'exécuter si
  // l'utilisateur quitte l'écran avant la fin des 2 secondes.
  useEffect(
    () => () => {
      if (redirection.current !== null) {
        window.clearTimeout(redirection.current);
        redirection.current = null;
      }
    },
    [],
  );

  // Dictionnaire nom de classe normalisé -> classeId
  const mapClasses = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of classes) {
      map.set(c.nom.toLowerCase().trim(), c.id);
    }
    return map;
  }, [classes]);

  // Parser le texte brut (CSV ou copier-coller depuis Excel)
  const lignesAnalysees = useMemo<LigneParsed[]>(() => {
    if (!texteColle.trim()) return [];

    const lignes = texteColle
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const resultats: LigneParsed[] = [];

    // Détecter si la 1ère ligne est un en-tête
    let debut = 0;
    if (lignes.length > 0) {
      const premiereLigne = lignes[0].toLowerCase();
      if (
        premiereLigne.includes("nom") ||
        premiereLigne.includes("prénom") ||
        premiereLigne.includes("prenom") ||
        premiereLigne.includes("parent")
      ) {
        debut = 1;
      }
    }

    for (let i = debut; i < lignes.length; i++) {
      const ligne = lignes[i];
      // Séparateurs possibles : tabulation (Excel), point-virgule (CSV FR), virgule (CSV US)
      let colonnes: string[] = [];
      if (ligne.includes("\t")) {
        colonnes = ligne.split("\t");
      } else if (ligne.includes(";")) {
        colonnes = ligne.split(";");
      } else {
        colonnes = ligne.split(",");
      }

      colonnes = colonnes.map((c) => c.replace(/^["']|["']$/g, "").trim());

      // Attendu idéal : Nom, Prénom, Sexe, Classe (facultative), Nom Parent, Téléphone Parent
      let nom = "";
      let prenom = "";
      let sexe: "M" | "F" = "M";
      let classeNomFichier = "";
      let nomParent = "";
      let telBrut = "";

      if (colonnes.length >= 6) {
        // Format complet : Nom, Prénom, Sexe, Classe, Nom Parent, Téléphone
        nom = colonnes[0] ?? "";
        prenom = colonnes[1] ?? "";
        sexe = (colonnes[2] ?? "").toUpperCase().startsWith("F") ? "F" : "M";
        classeNomFichier = colonnes[3] ?? "";
        nomParent = colonnes[4] ?? "";
        telBrut = colonnes[5] ?? "";
      } else if (colonnes.length === 5) {
        // Format sans colonne classe : Nom, Prénom, Sexe, Nom Parent, Téléphone
        nom = colonnes[0] ?? "";
        prenom = colonnes[1] ?? "";
        sexe = (colonnes[2] ?? "").toUpperCase().startsWith("F") ? "F" : "M";
        nomParent = colonnes[3] ?? "";
        telBrut = colonnes[4] ?? "";
      } else if (colonnes.length === 4) {
        // Format simplifié : Nom, Prénom, Nom Parent, Téléphone
        nom = colonnes[0] ?? "";
        prenom = colonnes[1] ?? "";
        sexe = "M";
        nomParent = colonnes[2] ?? "";
        telBrut = colonnes[3] ?? "";
      } else {
        nom = colonnes[0] ?? "";
        prenom = colonnes[1] ?? "";
        nomParent = colonnes[2] ?? "";
        telBrut = colonnes[3] ?? "";
      }

      // Résolution de la classe
      let classeIdResolue = classeDefaut;
      if (classeNomFichier) {
        const trouve = mapClasses.get(classeNomFichier.toLowerCase().trim());
        if (trouve) classeIdResolue = trouve;
      }

      const telNormalise = normaliserTelephone(telBrut);

      let erreur: string | undefined;
      if (nom.length < 2) erreur = "Nom manquant";
      else if (prenom.length < 2) erreur = "Prénom manquant";
      else if (!classeIdResolue) erreur = "Classe non spécifiée";
      else if (nomParent.length < 2) erreur = "Nom du parent manquant";
      else if (!telNormalise) erreur = "Numéro Togo invalide (8 chiffres)";

      resultats.push({
        id: `ligne-${i}`,
        nom,
        prenom,
        sexe,
        nomParent,
        telephoneParentBrut: telBrut,
        telephoneParent: telNormalise,
        classeNom: classeNomFichier || undefined,
        classeId: classeIdResolue,
        erreur,
      });
    }

    return resultats;
  }, [texteColle, classeDefaut, mapClasses]);

  const lignesValides = lignesAnalysees.filter((l) => !l.erreur);
  const nbErreurs = lignesAnalysees.length - lignesValides.length;

  function telechargerModele() {
    const exempleClasse = classes[0]?.nom ?? "6ème A";
    const entetes = "Nom;Prénom;Sexe;Classe;Nom Parent;Téléphone Parent\n";
    const lignesExemples = [
      `KODJO;Afi;F;${exempleClasse};KODJO Koffi;90123456`,
      `MENSAH;Komla;M;${exempleClasse};MENSAH Akou;91234567`,
      `LAWSON;Fifi;F;${exempleClasse};LAWSON Emmanuel;92345678`,
    ].join("\n");

    const blob = new Blob([`\uFEFF${entetes}${lignesExemples}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = "Modele_Import_Eleves_ECOLE_PAY.csv";
    lien.click();
    URL.revokeObjectURL(url);
  }

  function gererFichier(e: React.ChangeEvent<HTMLInputElement>) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;

    setNomFichier(fichier.name);
    setErreurGlobale(null);
    setSuccesGlobal(null);

    const lecteur = new FileReader();
    lecteur.onload = (evenement) => {
      const contenu = (evenement.target?.result as string) ?? "";
      setTexteColle(contenu);
    };
    lecteur.readAsText(fichier, "UTF-8");
  }

  function executerImport() {
    setErreurGlobale(null);
    setSuccesGlobal(null);

    if (lignesValides.length === 0) {
      setErreurGlobale("Aucun élève valide à importer.");
      return;
    }

    const payload: EleveImportDonnee[] = lignesValides.map((l) => ({
      nom: l.nom,
      prenom: l.prenom,
      sexe: l.sexe,
      classeId: l.classeId!,
      nomParent: l.nomParent,
      telephoneParent: l.telephoneParent!,
      typeInscription,
    }));

    demarrer(async () => {
      try {
        const res = await importerEleves(payload);
        if (res.error) {
          setErreurGlobale(res.error);
        } else if (res.success) {
          setSuccesGlobal(res.success);
          setTexteColle("");
          setNomFichier(null);
          redirection.current = window.setTimeout(() => {
            redirection.current = null;
            router.push("/app/eleves");
          }, 2000);
        }
      } catch {
        setErreurGlobale("Une erreur inattendue est survenue lors de l'importation.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/app/eleves"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted hover:text-ink"
        >
          <ArrowLeft size={15} aria-hidden />
          Retour à la liste des élèves
        </Link>
        <button
          type="button"
          onClick={telechargerModele}
          className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-surface-2"
        >
          <Download size={13} aria-hidden />
          Télécharger le modèle Excel / CSV
        </button>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-[16px] font-semibold text-ink">
          Importer des élèves en lot
        </h2>
        <p className="mt-1 text-[12.5px] text-muted">
          Ajoutez rapidement toute une classe ou tout un établissement. Vous
          pouvez soit importer un fichier CSV, soit copier-coller directement les
          lignes depuis Microsoft Excel.
        </p>

        {erreurGlobale && (
          <div className="mt-4">
            <Alerte>{erreurGlobale}</Alerte>
          </div>
        )}

        {succesGlobal && (
          <div className="mt-4">
            <Alerte ton="succes">{succesGlobal}</Alerte>
          </div>
        )}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {/* Classe par défaut */}
          <div>
            <label className="label" htmlFor="classe-defaut">
              Classe par défaut
            </label>
            <select
              id="classe-defaut"
              value={classeDefaut}
              onChange={(e) => setClasseDefaut(e.target.value)}
              className="input h-10"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
            <p className="aide">
              Attribuée automatiquement aux élèves sans classe indiquée dans le fichier.
            </p>
          </div>

          {/* Fichier CSV */}
          <div>
            <label className="label" htmlFor="fichier-csv">
              Téléverser un fichier .csv
            </label>
            <div className="relative flex items-center">
              <input
                id="fichier-csv"
                type="file"
                accept=".csv,text/csv,text/plain"
                onChange={gererFichier}
                className="block w-full text-[12px] text-muted file:mr-2 file:rounded-sm file:border-0 file:bg-brand-soft file:px-2.5 file:py-1.5 file:text-[11.5px] file:font-semibold file:text-brand"
              />
            </div>
            {nomFichier && (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-paye">
                <FileSpreadsheet size={12} aria-hidden /> Fichier chargé : {nomFichier}
              </p>
            )}
          </div>
        </div>

        {/* Type d'inscription appliqué à tout l'import */}
        <div className="mt-4">
          <p className="label">Ces élèves sont…</p>
          <div className="grid grid-cols-2 gap-2 sm:max-w-md">
            {[
              {
                valeur: "NOUVEAU" as const,
                libelle: "Nouveaux élèves",
                detail: "Frais d'inscription",
              },
              {
                valeur: "ANCIEN" as const,
                libelle: "Anciens élèves",
                detail: "Frais de réinscription",
              },
            ].map((option) => (
              <label
                key={option.valeur}
                className={
                  typeInscription === option.valeur
                    ? "flex cursor-pointer flex-col rounded-sm border border-brand bg-brand-soft px-3 py-2.5 text-brand"
                    : "flex cursor-pointer flex-col rounded-sm border border-line-strong bg-surface px-3 py-2.5 text-ink-2 hover:bg-surface-2"
                }
              >
                <input
                  type="radio"
                  name="type-inscription-import"
                  value={option.valeur}
                  checked={typeInscription === option.valeur}
                  onChange={() => setTypeInscription(option.valeur)}
                  className="sr-only"
                />
                <span className="text-[12.5px] font-semibold">{option.libelle}</span>
                <span className="text-[10px] opacity-70">{option.detail}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Zone de saisie / collage */}
        <div className="mt-4">
          <label className="label" htmlFor="texte-colle">
            Ou collez vos données directement depuis Excel
          </label>
          <textarea
            id="texte-colle"
            rows={5}
            value={texteColle}
            onChange={(e) => {
              setTexteColle(e.target.value);
              setNomFichier(null);
            }}
            placeholder={`Nom\tPrénom\tSexe\tClasse\tNom Parent\tTéléphone Parent\nKODJO\tAfi\tF\t6ème A\tKODJO Koffi\t90123456\nMENSAH\tKomla\tM\t6ème A\tMENSAH Akou\t91234567`}
            className="input font-mono text-[11.5px] leading-relaxed"
          />
          <p className="aide">
            Format attendu : Nom, Prénom, Sexe (M/F), Classe (optionnelle), Nom
            Parent, Téléphone Parent (8 chiffres togolais).
          </p>
        </div>
      </div>

      {/* Prévisualisation */}
      {lignesAnalysees.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-[13.5px] font-semibold text-ink">
                Aperçu de l&apos;import ({lignesAnalysees.length} élève{lignesAnalysees.length > 1 ? "s" : ""})
              </h3>
              <p className="mt-0.5 text-[11.5px] text-muted">
                <span className="font-semibold text-paye">
                  {lignesValides.length} valide{lignesValides.length > 1 ? "s" : ""}
                </span>
                {nbErreurs > 0 && (
                  <span className="ml-2 font-semibold text-impaye">
                    · {nbErreurs} à corriger
                  </span>
                )}
              </p>
            </div>
            <Bouton
              type="button"
              disabled={enCours || lignesValides.length === 0}
              onClick={executerImport}
            >
              {enCours ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <UploadCloud size={15} aria-hidden />
              )}
              {enCours
                ? "Importation en cours…"
                : `Importer les ${lignesValides.length} élèves valides`}
            </Bouton>
          </div>

          <div className="overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Statut</th>
                  <th>Élève</th>
                  <th>Sexe</th>
                  <th>Type</th>
                  <th>Classe</th>
                  <th>Parent / Tuteur</th>
                  <th>Téléphone WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {lignesAnalysees.map((l) => {
                  const classeNom =
                    classes.find((c) => c.id === l.classeId)?.nom ?? "Inconnue";
                  return (
                    <tr key={l.id} className={l.erreur ? "bg-impaye-soft/40" : ""}>
                      <td>
                        {l.erreur ? (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-impaye"
                            title={l.erreur}
                          >
                            <XCircle size={13} aria-hidden />
                            {l.erreur}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-paye">
                            <CheckCircle2 size={13} aria-hidden />
                            Prêt
                          </span>
                        )}
                      </td>
                      <td className="font-medium text-ink">
                        {l.prenom} {l.nom}
                      </td>
                      <td className="chiffre text-[11.5px] text-muted">{l.sexe}</td>
                      <td className="text-[11.5px] text-ink-2">
                        {typeInscription === "ANCIEN" ? "Ancien" : "Nouveau"}
                      </td>
                      <td>
                        <Badge>{classeNom}</Badge>
                      </td>
                      <td className="text-[12px] text-ink-2">{l.nomParent}</td>
                      <td className="chiffre text-[12px]">
                        {l.telephoneParent ? (
                          formatTelephone(l.telephoneParent)
                        ) : (
                          <span className="text-impaye">
                            {l.telephoneParentBrut || "Manquant"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
