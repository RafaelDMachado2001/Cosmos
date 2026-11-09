<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Content\Models\Publication;
use App\Modules\Content\Models\PublicationDraft;
use App\Modules\Content\Models\PublicationTranslation;
use App\Modules\Content\Rules\ValidDraftBlocks;
use App\Modules\Content\Support\DraftBlocksCli;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StudioToolsController extends Controller
{
    public function preview(Publication $publication): JsonResponse
    {
        $publication->load(['drafts', 'translations']);

        $locales = [];
        foreach (PublicationTranslation::locales() as $locale) {
            $draft = $publication->drafts->firstWhere('locale', $locale);
            $published = $publication->translations->firstWhere('locale', $locale);
            $blocks = $draft instanceof PublicationDraft ? $draft->blocks : [];

            $locales[$locale] = [
                'draft' => $draft instanceof PublicationDraft ? [
                    'title' => $draft->title,
                    'subtitle' => $draft->subtitle,
                    'markdown' => $blocks === [] ? '' : DraftBlocksCli::toMarkdown($blocks),
                    'diagramErrors' => $blocks === [] ? [] : DraftBlocksCli::diagramErrors($blocks),
                ] : null,
                'published' => $published instanceof PublicationTranslation ? [
                    'title' => $published->title,
                    'summary' => $published->summary,
                    'markdown' => $published->body,
                ] : null,
            ];
        }

        return response()->json(['data' => [
            'id' => $publication->id,
            'slug' => $publication->slug,
            'status' => $publication->status,
            'locales' => $locales,
        ]]);
    }

    public function toBlocks(Request $request): JsonResponse
    {
        $data = $request->validate([
            'markdown' => ['present', 'nullable', 'string', 'max:200000'],
        ]);

        return response()->json(['data' => DraftBlocksCli::toBlocks((string) ($data['markdown'] ?? ''))]);
    }

    public function toMarkdown(Request $request): JsonResponse
    {
        $data = $request->validate([
            'blocks' => ['present', 'array', new ValidDraftBlocks],
        ]);

        $blocks = ValidDraftBlocks::normalizeTables($data['blocks']);

        return response()->json(['data' => [
            'markdown' => $blocks === [] ? '' : DraftBlocksCli::toMarkdown($blocks),
            'diagramErrors' => $blocks === [] ? [] : DraftBlocksCli::diagramErrors($blocks),
        ]]);
    }
}
