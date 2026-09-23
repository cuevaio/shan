import type { Metadata } from "next";
import { PitchDeck } from "./pitch-deck";

export const metadata: Metadata = {
  title: "Shan — Draw the change",
  description: "The five-minute Shan pitch for Accel AI Innovate Amsterdam.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
