<?php

declare(strict_types=1);

namespace App\Modules\Content\Filament\Resources\Publications\Tables;

use App\Modules\Content\Models\Publication;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class PublicationsTable
{
    public static function configure(Table $table): Table
    {
        return $table
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

                TextColumn::make('engagement_comments')
                    ->label('Comentários')
                    ->state(fn (Publication $record, HasTable $livewire): int => EngagementLookups::for($livewire)->of($record->id)->comments)
                    ->url(function (Publication $record, HasTable $livewire): ?string {
                        $engagement = EngagementLookups::for($livewire)->of($record->id);

                        return $engagement->comments > 0 ? $engagement->moderationUrl : null;
                    })
                    ->alignEnd(),

                TextColumn::make('engagement_reactions')
                    ->label('Reações')
                    ->state(fn (Publication $record, HasTable $livewire): int => EngagementLookups::for($livewire)->of($record->id)->reactions)
                    ->alignEnd(),
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
            ->recordUrl(fn (Publication $record): string => self::studioUrl($record))
            ->recordActions([
                Action::make('studio')
                    ->label('Editar no Studio')
                    ->icon(Heroicon::OutlinedPencilSquare)
                    ->url(fn (Publication $record): string => self::studioUrl($record)),
            ])
            ->toolbarActions([BulkActionGroup::make([DeleteBulkAction::make()])]);
    }

    public static function studioUrl(Publication $publication): string
    {
        return route('rdm-studio', ['publication' => $publication->id]);
    }
}
