import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { I18nProvider } from "@/components/I18nProvider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

const themeInitScript = `
(() => {
  try {
    const root = document.documentElement;
    const theme = localStorage.getItem('braillevision-theme') || root.getAttribute('data-theme') || 'light';
    const accent = localStorage.getItem('braillevision-accent') || root.getAttribute('data-accent') || 'sunrise';
    const density = localStorage.getItem('braillevision-density') || root.getAttribute('data-density') || 'comfortable';

    root.setAttribute('data-theme', theme);
    root.setAttribute('data-accent', accent);
    root.setAttribute('data-density', density);
  } catch {
    // no-op
  }
})();
`;

export const metadata = {
  title: "Braille Vision Dashboard",
  description: "Convert, tag, filter, export, and manage Braille documents with personalized dashboard preferences.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" data-accent="sunrise" data-density="comfortable" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>
        <I18nProvider>
          <AuthProvider>
            <div className="fixed right-4 top-4 z-50 md:right-6 md:top-6">
              <LanguageSwitcher />
            </div>
            {children}
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
