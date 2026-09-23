import type { Metadata } from "next";
import { NebiToolbar } from "nebi-agent";
import "./styles.css";

export const metadata: Metadata = {
  title: "Nebi Next.js example",
  description: "Review-first code changes from inside your application.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <NebiToolbar />
      </body>
    </html>
  );
}
