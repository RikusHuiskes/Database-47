import type { Metadata } from "next";
import AmsterdamDemo from "./AmsterdamDemo";

export const metadata: Metadata = {
  title: "Amsterdam-demo | Côte de Duras",
  description: "Een geïsoleerde proef van de evenementenkalender en gemeentegids rond Amsterdam.",
};

export default function AmsterdamDemoPage() {
  return <AmsterdamDemo />;
}
