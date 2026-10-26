<?php

// GERADO por `npm run emit:seed` a partir de src/core/types.ts. Não editar:
// a próxima emissão sobrescreve. O vocabulário tem fonte única no frontend, e
// a paridade é o que torna a troca de adapter invisível.
//
// Exceção congelada: o CASE da migration create_publication_translations_table
// repete pt/en e os dicionários. Migration aplicada não se reescreve.

declare(strict_types=1);

return [
    'locales' => ['pt', 'en'],
    'categories' => ['artigo', 'projeto', 'estudo', 'rotina'],
    'dictionaries' => [
        'pt' => 'portuguese',
        'en' => 'english',
    ],
];
