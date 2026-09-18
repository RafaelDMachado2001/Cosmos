<?php

declare(strict_types=1);

namespace App\Filament\Resources\Publications\Schemas;

use App\Models\Publication;
use App\Models\PublicationTranslation;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Illuminate\Database\Eloquent\Model;

class PublicationForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Publicação')
                ->description('O slug alimenta o hash que decide a altura da estrela. Mudá-lo move a publicação de lugar na constelação.')
                ->columns(2)
                ->schema([
                    TextInput::make('slug')
                        ->required()
                        ->maxLength(255)
                        ->unique(ignoreRecord: true)
                        // ASCII e sem acento: o FNV-1a precisa render o mesmo
                        // inteiro sobre bytes UTF-8 aqui e sobre code units
                        // UTF-16 no navegador, senão a estrela muda de altura.
                        ->rule('regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/')
                        ->helperText('Minúsculas, números e hífens. Sem acento.'),

                    Select::make('category')
                        ->required()
                        ->options(array_combine(Publication::CATEGORIES, [
                            'Artigo técnico',
                            'Projeto',
                            'Estudo',
                            'Rotina',
                        ])),

                    DateTimePicker::make('published_at')
                        ->required()
                        ->seconds(false)
                        ->helperText('Decide a posição horizontal na linha do tempo.'),

                    Select::make('status')
                        ->required()
                        ->default(Publication::STATUS_DRAFT)
                        ->options([
                            Publication::STATUS_DRAFT => 'Rascunho',
                            Publication::STATUS_PUBLISHED => 'Publicado',
                        ])
                        ->helperText('Só "Publicado" chega à API pública.'),

                    Toggle::make('featured')
                        ->label('Destaque')
                        ->helperText('Desenha a estrela maior.'),
                ]),

            Section::make('Conteúdo')
                ->description('Uma tradução por idioma. Sem a tradução, a publicação não aparece naquele idioma — em vez de aparecer sem título.')
                ->schema([
                    Repeater::make('translations')
                        ->hiddenLabel()
                        ->relationship()
                        ->addActionLabel('Acrescentar idioma')
                        // Dois idiomas e nada mais: a chave única do banco é
                        // (publication_id, locale), e uma terceira linha seria
                        // recusada lá embaixo, depois de a pessoa ter escrito.
                        ->maxItems(count(PublicationTranslation::LOCALES))
                        ->itemLabel(fn (array $state): ?string => match ($state['locale'] ?? null) {
                            'pt' => 'Português',
                            'en' => 'English',
                            default => null,
                        })
                        ->schema([
                            Select::make('locale')
                                ->label('Idioma')
                                ->required()
                                ->live()
                                ->options(['pt' => 'Português', 'en' => 'English'])
                                ->distinct(),

                            TextInput::make('title')
                                ->label('Título')
                                ->required()
                                ->maxLength(255),

                            Textarea::make('summary')
                                ->label('Resumo')
                                ->required()
                                ->rows(2)
                                ->helperText('Aparece no cartão de hover e na meta description.'),

                            Textarea::make('body')
                                ->label('Texto')
                                ->required()
                                ->rows(14)
                                ->helperText('Separe os parágrafos com uma linha em branco: é assim que a API os divide.'),
                        ]),
                ]),
        ]);
    }

    /** O que a lista mostra como nome de cada linha. */
    public static function titleFor(Model $record): string
    {
        return $record->translations->firstWhere('locale', 'pt')?->title
            ?? $record->translations->first()?->title
            ?? $record->slug;
    }
}
