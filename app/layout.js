import "./globals.css";

export const metadata = {
  title: "Bolka CIF Demo",
  description: "Dynamics 365 Channel Integration Framework test harness",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
