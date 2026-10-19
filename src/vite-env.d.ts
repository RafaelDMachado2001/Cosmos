/// <reference types="vite/client" />

/** Origem absoluta do site, injetada no build a partir de VITE_SITE_URL. */
declare const __SITE_ORIGIN__: string;

/** Base da API do Laravel, ou `null` quando o acervo semente é a fonte. */
declare const __API_URL__: string | null;

/** Liga o Vercel Web Analytics: só no build de produção da Vercel. */
declare const __ANALYTICS__: boolean;
