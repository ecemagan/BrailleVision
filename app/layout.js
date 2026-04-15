import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata = {
  title: "Braille Vision Dashboard",
  description: "Convert, tag, filter, export, and manage Braille documents with personalized dashboard preferences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="tr" data-theme="light" data-accent="sunrise" data-density="comfortable">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
