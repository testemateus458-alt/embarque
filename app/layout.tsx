import type { Metadata } from "next";
import "./globals.css";
import "./extra.css";
import "./packem.css";
import "./control-room.css";
import "./refined.css";
import "./control-tower.css";
import "./production-v2.css";
import "./system-ui.css";
export const metadata: Metadata = {title:"Packem • Torre de Embarques",description:"Central operacional de cargas, docas e embarques."};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="pt-BR"><body>{children}</body></html>}
