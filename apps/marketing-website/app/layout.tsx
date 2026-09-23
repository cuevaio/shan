import type { Metadata } from "next";
import { ShanEditor } from "shan";
import "./styles.css";

export const metadata: Metadata = {
  title: "Shan marketing website example",
  description: "Visual, review-first interface changes from inside a website.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        {children}
        <ShanEditor />
      </body>
    </html>
  );
}
