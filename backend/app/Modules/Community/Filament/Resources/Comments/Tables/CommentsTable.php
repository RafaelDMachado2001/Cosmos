<?php

declare(strict_types=1);

namespace App\Modules\Community\Filament\Resources\Comments\Tables;

use App\Modules\Community\Actions\SetCommentVisibility;
use App\Modules\Community\Models\Comment;
use App\Modules\Content\Contracts\PublicationSlugs;
use Filament\Actions\Action;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class CommentsTable
{
    private const array STATUS_LABELS = [
        Comment::STATUS_PUBLISHED => 'Visível',
        Comment::STATUS_HIDDEN => 'Oculto',
        Comment::STATUS_DELETED => 'Apagado pelo autor',
    ];

    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('id', 'desc')
            ->columns([
                TextColumn::make('body')
                    ->label('Comentário')
                    ->placeholder('—')
                    ->searchable()
                    ->wrap()
                    ->limit(120),

                TextColumn::make('member_id')
                    ->label('Autor')
                    ->formatStateUsing(fn (int $state, HasTable $livewire): string => CommentLookups::for($livewire)->author($state)),

                TextColumn::make('publication_id')
                    ->label('Publicação')
                    ->formatStateUsing(fn (int $state, HasTable $livewire): string => CommentLookups::for($livewire)->publication($state)),

                TextColumn::make('locale')
                    ->label('Idioma')
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => strtoupper($state)),

                TextColumn::make('status')
                    ->label('Situação')
                    ->badge()
                    ->color(fn (string $state): string => match ($state) {
                        Comment::STATUS_PUBLISHED => 'success',
                        Comment::STATUS_HIDDEN => 'warning',
                        default => 'gray',
                    })
                    ->formatStateUsing(fn (string $state): string => self::STATUS_LABELS[$state] ?? $state),

                TextColumn::make('created_at')
                    ->label('Enviado em')
                    ->dateTime('d/m/Y H:i')
                    ->sortable(),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Situação')
                    ->options(self::STATUS_LABELS),
                SelectFilter::make('publication_id')
                    ->label('Publicação')
                    ->searchable()
                    ->getSearchResultsUsing(static fn (string $search): array => array_filter(
                        self::commentedPublications(),
                        static fn (string $slug): bool => str_contains($slug, mb_strtolower($search)),
                    ))
                    ->getOptionLabelUsing(static fn (mixed $value): string => app(PublicationSlugs::class)->forIds([(int) $value])[(int) $value] ?? '—'),
            ])
            ->recordActions([
                Action::make('hide')
                    ->label('Ocultar')
                    ->icon(Heroicon::OutlinedEyeSlash)
                    ->color('warning')
                    ->requiresConfirmation()
                    ->visible(fn (Comment $record): bool => $record->status === Comment::STATUS_PUBLISHED)
                    ->action(fn (Comment $record) => app(SetCommentVisibility::class)->handle($record, false)),

                Action::make('restore')
                    ->label('Mostrar de novo')
                    ->icon(Heroicon::OutlinedEye)
                    ->visible(fn (Comment $record): bool => $record->status === Comment::STATUS_HIDDEN)
                    ->action(fn (Comment $record) => app(SetCommentVisibility::class)->handle($record, true)),
            ]);
    }

    /** @return array<int, string> */
    private static function commentedPublications(): array
    {
        return app(PublicationSlugs::class)->forIds(
            Comment::query()->distinct()->pluck('publication_id')->map(static fn (mixed $id): int => (int) $id)->all(),
        );
    }
}
