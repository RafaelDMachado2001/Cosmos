<?php

declare(strict_types=1);

namespace App\Filament\Resources\Publications\Tables;

use App\Models\Publication;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class PublicationsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            // Mesma ordem da constelação e do índice do banco: do mais novo
            // para o mais antigo.
            ->defaultSort('published_at', 'desc')
            ->columns([
                TextColumn::make('translations.title')
                    ->label('Título')
                    ->searchable()
                    ->wrap()
                    ->limit(60),

                TextColumn::make('slug')
                    ->searchable()
                    ->toggleable(isToggledHiddenByDefault: true),

                TextColumn::make('category')
                    ->label('Categoria')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => match ($state) {
                        'artigo' => 'Artigo técnico',
                        'projeto' => 'Projeto',
                        'estudo' => 'Estudo',
                        default => 'Rotina',
                    }),

                TextColumn::make('published_at')
                    ->label('Publicado em')
                    ->dateTime('d/m/Y')
                    ->sortable(),

                TextColumn::make('status')
                    ->label('Situação')
                    ->badge()
                    ->color(fn (string $state): string => $state === Publication::STATUS_PUBLISHED ? 'success' : 'gray')
                    ->formatStateUsing(fn (string $state): string => $state === Publication::STATUS_PUBLISHED ? 'Publicado' : 'Rascunho'),

                IconColumn::make('featured')
                    ->label('Destaque')
                    ->boolean(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Situação')
                    ->options([
                        Publication::STATUS_PUBLISHED => 'Publicado',
                        Publication::STATUS_DRAFT => 'Rascunho',
                    ]),

                SelectFilter::make('category')
                    ->label('Categoria')
                    ->options(array_combine(Publication::CATEGORIES, [
                        'Artigo técnico',
                        'Projeto',
                        'Estudo',
                        'Rotina',
                    ])),
            ])
            ->recordActions([EditAction::make()])
            ->toolbarActions([BulkActionGroup::make([DeleteBulkAction::make()])]);
    }
}
