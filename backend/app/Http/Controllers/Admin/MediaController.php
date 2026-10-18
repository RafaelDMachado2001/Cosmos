<?php

declare(strict_types=1);

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\MediaResource;
use App\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Image\Image;

class MediaController extends Controller
{
    /** O alvo do handoff: 1600px de largura, nunca upscale. */
    private const int MAX_WIDTH = 1600;

    public function store(Request $request): MediaResource
    {
        $data = $request->validate([
            'file' => ['required', 'image', 'max:20480'],
            'alt' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        Storage::disk('public')->makeDirectory('media');

        $filename = Str::uuid()->toString().'.webp';
        $path = Storage::disk('public')->path('media/'.$filename);

        $image = Image::load($data['file']->getRealPath());
        if ($image->getWidth() > self::MAX_WIDTH) {
            $image->width(self::MAX_WIDTH);
        }
        $image->format('webp')->save($path);

        $media = Media::create([
            'path' => 'media/'.$filename,
            'width' => $image->getWidth(),
            'height' => $image->getHeight(),
            'mime' => 'image/webp',
            'alt_default' => $data['alt'] ?? null,
        ]);

        return new MediaResource($media);
    }
}
