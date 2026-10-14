<?php

// GERADO por `npm run emit:seed` a partir de src/core/types.ts. Nao editar:
// a proxima emissao sobrescreve. O vocabulario tem fonte unica no frontend, e
// a paridade e o que torna a troca de adapter invisivel.
//
// Excecao congelada: o CASE da migration create_publication_translations_table
// repete pt/en e os dicionarios. Migration aplicada nao se reescreve.

declare(strict_types=1);

return [
    'locales' => ['pt', 'en'],
    'categories' => ['artigo', 'projeto', 'estudo', 'rotina'],
    'dictionaries' => [
        'pt' => 'portuguese',
        'en' => 'english',
    ],
];
