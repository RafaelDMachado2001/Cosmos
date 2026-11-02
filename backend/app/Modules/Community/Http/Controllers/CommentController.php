<?php

declare(strict_types=1);

namespace App\Modules\Community\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Community\Actions\DeleteComment;
use App\Modules\Community\Actions\PostComment;
use App\Modules\Community\Http\CurrentMember;
use App\Modules\Community\Http\PublicationTarget;
use App\Modules\Community\Http\Resources\CommentResource;
use App\Modules\Community\Models\Comment;
use App\Modules\Community\Support\CommentBody;
use App\Modules\Identity\Contracts\PublicProfiles;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rule;

class CommentController extends Controller
{
    private const int PAGE_SIZE = 20;

    public function __construct(private readonly PublicProfiles $profiles) {}

    public function index(Request $request, string $slug): JsonResponse
    {
        $target = PublicationTarget::fromRequest($request, $slug);
        $after = (int) ($request->validate(['after' => ['sometimes', 'integer', 'min:1']])['after'] ?? 0);

        $comments = Comment::query()
            ->visible()
            ->where('publication_id', $target->id)
            ->where('locale', $target->locale)
            ->where('id', '>', $after)
            ->orderBy('id')
            ->limit(self::PAGE_SIZE + 1)
            ->get();

        $page = $comments->take(self::PAGE_SIZE);
        $profiles = $this->profiles->forMembers($page->pluck('member_id')->all());

        return response()->json([
            'data' => $page->map(fn (Comment $comment): array => (new CommentResource($comment, $profiles[$comment->member_id] ?? null))->resolve($request))->values(),
            'meta' => [
                'count' => $page->count(),
                'next' => $comments->count() > self::PAGE_SIZE ? $page->last()?->id : null,
            ],
        ]);
    }

    public function store(Request $request, PostComment $post): JsonResponse
    {
        $data = $request->validate([
            'publication' => ['required', 'string'],
            'locale' => ['required', 'string', Rule::in((array) config('publications.locales'))],
            'body' => ['required', 'string', static function (string $attribute, mixed $value, Closure $fail): void {
                if (is_string($value) && mb_strlen(CommentBody::normalize($value)) > CommentBody::maxLength()) {
                    $fail('O comentário passa de '.CommentBody::maxLength().' caracteres.');
                }
            }],
        ]);

        $memberId = CurrentMember::id($request);
        $target = PublicationTarget::fromRequest($request, $data['publication']);
        $comment = $post->handle($memberId, $target->id, $target->locale, $data['body']);
        $author = $this->profiles->forMembers([$memberId])[$memberId] ?? null;

        return (new CommentResource($comment, $author))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, int $comment, DeleteComment $delete): Response
    {
        $delete->handle(Comment::query()->visible()->findOrFail($comment), CurrentMember::id($request));

        return response()->noContent();
    }
}
