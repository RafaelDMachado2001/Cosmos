<?php

declare(strict_types=1);

namespace App\Modules\Community\Filament\Resources\Comments;

use App\Modules\Community\Filament\Resources\Comments\Pages\ListComments;
use App\Modules\Community\Filament\Resources\Comments\Tables\CommentsTable;
use App\Modules\Community\Models\Comment;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

class CommentResource extends Resource
{
    protected static ?string $model = Comment::class;

    protected static ?string $modelLabel = 'comentário';

    protected static ?string $pluralModelLabel = 'comentários';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedChatBubbleLeftRight;

    public static function table(Table $table): Table
    {
        return CommentsTable::configure($table);
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function getPages(): array
    {
        return [
            'index' => ListComments::route('/'),
        ];
    }
}
