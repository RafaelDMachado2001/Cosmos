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
                    // "Publicado" com published_at no futuro não é visível na
                    // API pública ainda — ver PublicationController::published().
                    // O rótulo precisa dizer isso, senão pareceria publicado de
                    // verdade até o comando de agendamento regenerar o site.
                    ->color(fn (Publication $record): string => match (true) {
                        $record->status !== Publication::STATUS_PUBLISHED => 'gray',
                        $record->published_at->isFuture() => 'warning',
                        default => 'success',
                    })
                    ->formatStateUsing(fn (Publication $record): string => match (true) {
                        $record->status !== Publication::STATUS_PUBLISHED => 'Rascunho',
                        $record->published_at->isFuture() => 'Agendado',
                        default => 'Publicado',
                    }),

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
                    ->options(array_combine(Publication::categories(), [
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
