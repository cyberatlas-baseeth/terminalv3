import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Terminal",
    description: "A terminal-style memory game. Identify the fake node to secure your connection.",
    openGraph: {
        title: "Terminal",
        description: "Can you identify the intruder? Test your memory in this hacker-themed game.",
        type: "website",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    themeColor: "#0a0a0a",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <meta name="fc:miniapp" content="true" />
            </head>
            <body>
                {children}
            </body>
        </html>
    );
}
