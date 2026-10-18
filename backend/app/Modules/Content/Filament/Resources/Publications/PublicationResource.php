<?php

namespace App\Modules\Content\Filament\Resources\Publications;

use App\Modules\Content\Filament\Resources\Publications\Pages\CreatePublication;
use App\Modules\Content\Filament\Resources\Publications\Pages\EditPublication;
use App\Modules\Content\Filament\Resources\Publications\Pages\ListPublications;
use App\Modules\Content\Filament\Resources\Publications\Schemas\PublicationForm;
use App\Modules\Content\Filament\Resources\Publications\Tables\PublicationsTable;
use App\Modules\Content\Models\Publication;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PublicationResource extends Resource
{
    protected static ?string $model = Publication::class;

    protected static ?string $modelLabel = 'publicação';

    protected static ?string $pluralModelLabel = 'publicações';

    protected static ?string $recordTitleAttribute = 'slug';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedRectangleStack;

    public static function form(Schema $schema): Schema
    {
        return PublicationForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return PublicationsTable::configure($table);
    }

    public static function getRelations(): array
    {
        return [];
    }

    /**
     * As traduções vêm junto.
     *
     * A lista mostra o título, que mora na tabela de traduções: sem isto seria
     * uma consulta por linha só para escrever o nome de cada publicação.
     */
    public static function getEloquentQuery(): Builder
    {
        return parent::getEloquentQuery()->with('translations');
    }

    public static function getPages(): array
    {
        return [
            'index' => ListPublications::route('/'),
            'create' => CreatePublication::route('/create'),
            'edit' => EditPublication::route('/{record}/edit'),
        ];
    }
}
