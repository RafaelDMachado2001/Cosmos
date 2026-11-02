<?php

declare(strict_types=1);

namespace App\Modules\Community\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Community\Actions\SetReaction;
use App\Modules\Community\Http\CurrentMember;
use App\Modules\Community\Http\PublicationTarget;
use App\Modules\Community\Models\Reaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReactionController extends Controller
{
    public function count(Request $request, string $slug): JsonResponse
    {
        $target = PublicationTarget::fromRequest($request, $slug);

        return response()->json(['data' => ['count' => $this->countFor($target->id)]]);
    }

    public function show(Request $request, string $slug): JsonResponse
    {
        $target = PublicationTarget::fromRequest($request, $slug);
        $memberId = CurrentMember::id($request);

        return $this->state($target->id, $this->reacted($target->id, $memberId));
    }

    public function store(Request $request, string $slug, SetReaction $react): JsonResponse
    {
        return $this->set($request, $slug, $react, true);
    }

    public function destroy(Request $request, string $slug, SetReaction $react): JsonResponse
    {
        return $this->set($request, $slug, $react, false);
    }

    private function set(Request $request, string $slug, SetReaction $react, bool $reacted): JsonResponse
    {
        $target = PublicationTarget::fromRequest($request, $slug);
        $react->handle(CurrentMember::id($request), $target->id, $reacted);

        return $this->state($target->id, $reacted);
    }

    private function state(int $publicationId, bool $reacted): JsonResponse
    {
        return response()->json(['data' => ['reacted' => $reacted, 'count' => $this->countFor($publicationId)]]);
    }

    private function countFor(int $publicationId): int
    {
        return Reaction::query()->where('publication_id', $publicationId)->count();
    }

    private function reacted(int $publicationId, int $memberId): bool
    {
        return Reaction::query()->where(['publication_id' => $publicationId, 'member_id' => $memberId])->exists();
    }
}
