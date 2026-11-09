import type { Locale } from '../core/types';

export interface PrivacySection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
}

export const PRIVACY_UPDATED = '2026-11-08';

export const PRIVACY: Record<Locale, readonly PrivacySection[]> = {
  pt: [
    {
      id: 'dados',
      title: 'Quais dados guardamos',
      paragraphs: [
        'Ler o Cosmos não pede conta e não guarda nada sobre quem lê. A conta só existe para comentar e marcar publicações.',
        'Quando você entra com Google ou GitHub, guardamos o que o provedor entrega: nome, e-mail verificado, endereço do avatar e o identificador da sua conta nele. Nunca recebemos sua senha.',
        'Junto com a conta ficam o @handle e o idioma que você escolher, os comentários que você publicar, as publicações que você marcar e um registro dessas ações (entrar pela primeira vez, comentar, apagar um comentário, marcar e desmarcar).',
      ],
    },
    {
      id: 'uso',
      title: 'Para que servem',
      paragraphs: [
        'Nome, @handle e avatar aparecem ao lado dos seus comentários. O e-mail serve só para ligar a mesma pessoa aos dois provedores e não é mostrado a ninguém.',
        'O registro de ações existe para moderar abuso e para que você possa baixar tudo o que fez. Nada disso é vendido, cedido ou usado para publicidade.',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      paragraphs: [
        'Há só dois cookies, os dois necessários para a conta funcionar: o da sessão, que mantém você conectado, e o XSRF-TOKEN, que protege os formulários contra envio forjado. Por isso não há banner de consentimento.',
        'A audiência do site é medida de forma agregada, sem cookie e sem identificar quem lê.',
      ],
    },
    {
      id: 'prazo',
      title: 'Por quanto tempo',
      paragraphs: [
        'Os dados ficam enquanto a conta existir. Ao apagar a conta, nome, e-mail, avatar e as ligações com os provedores são removidos, seus comentários saem do ar e suas marcações são apagadas. O registro de ações perde o conteúdo e fica só como contagem anônima.',
      ],
    },
    {
      id: 'direitos',
      title: 'Seus direitos',
      paragraphs: [
        'Em Minha conta você corrige nome, @handle e idioma, baixa todos os seus dados num arquivo JSON e apaga a conta. São os direitos de acesso, correção, portabilidade e eliminação da LGPD, sem precisar pedir a ninguém.',
      ],
    },
    {
      id: 'contato',
      title: 'Contato',
      paragraphs: [
        'O RDM Labs é mantido por Rafael Dorneles Machado. Dúvidas sobre estes dados podem ser enviadas pelos contatos em portfolio.rdmlabs.com.br.',
      ],
    },
  ],
  en: [
    {
      id: 'data',
      title: 'What data we keep',
      paragraphs: [
        'Reading the Cosmos needs no account and keeps nothing about readers. An account exists only to comment and mark publications.',
        'When you sign in with Google or GitHub, we keep what the provider hands over: name, verified email, avatar address and your account identifier there. We never receive your password.',
        'Alongside the account we keep the @handle and language you choose, the comments you post, the publications you mark and a log of those actions (first sign-in, commenting, deleting a comment, marking and unmarking).',
      ],
    },
    {
      id: 'use',
      title: 'What it’s for',
      paragraphs: [
        'Name, @handle and avatar appear next to your comments. The email only links the same person across both providers and is never shown to anyone.',
        'The action log exists to moderate abuse and so you can download everything you did. None of it is sold, shared or used for advertising.',
      ],
    },
    {
      id: 'cookies',
      title: 'Cookies',
      paragraphs: [
        'There are only two cookies, both needed for the account to work: the session one, which keeps you signed in, and XSRF-TOKEN, which protects forms against forged submissions. That’s why there is no consent banner.',
        'Site traffic is measured in aggregate, without cookies and without identifying readers.',
      ],
    },
    {
      id: 'retention',
      title: 'How long',
      paragraphs: [
        'The data stays while the account exists. When you delete the account, name, email, avatar and the provider links are removed, your comments go offline and your marks are deleted. The action log loses its content and remains only as an anonymous count.',
      ],
    },
    {
      id: 'rights',
      title: 'Your rights',
      paragraphs: [
        'In My account you can correct your name, @handle and language, download all your data as a JSON file and delete the account. These are the access, correction, portability and erasure rights under Brazil’s LGPD, with no need to ask anyone.',
      ],
    },
    {
      id: 'contact',
      title: 'Contact',
      paragraphs: [
        'RDM Labs is run by Rafael Dorneles Machado. Questions about this data can be sent through the contacts at portfolio.rdmlabs.com.br.',
      ],
    },
  ],
};
