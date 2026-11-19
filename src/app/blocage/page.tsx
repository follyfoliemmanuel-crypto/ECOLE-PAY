import { redirect } from "next/navigation";

/**
 * Ancienne page de blocage : un impayé ne coupe plus l'accès. L'école reste en
 * lecture seule et règle son abonnement depuis la page dédiée.
 */
export default function PageBlocage() {
  redirect("/abonnement");
}
