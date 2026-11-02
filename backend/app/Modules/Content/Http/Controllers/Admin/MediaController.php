<?php

declare(strict_types=1);

namespace App\Modules\Content\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Content\Http\Resources\Admin\MediaResource;
use App\Modules\Content\Models\Media;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\Image\Image;

class MediaController extends Controller
{
    private const int MAX_WIDTH = 1600;

    private const int MAX_PIXELS = 16_000_000;

    public function store(Request $request): MediaResource
    {
        $data = $request->validate([
            'file' => [
                'required', 'image', 'max:20480',
                static function (string $attribute, mixed $value, \Closure $fail): void {
                    $size = $value instanceof UploadedFile ? @getimagesize($value->getRealPath()) : false;
                    if ($size !== false && $size[0] * $size[1] > self::MAX_PIXELS) {
                        $fail('A imagem passa de 16 megapixels. Reduza antes de enviar.');
                    }
                },
            ],
            'alt' => ['sometimes', 'nullable', 'string', 'max:255'],
        ]);

        $path = 'media/'.Str::uuid()->toString().'.webp';

        $reserved = (string) tempnam(sys_get_temp_dir(), 'media');
        $temporary = $reserved.'.webp';
        try {
            $image = Image::load($data['file']->getRealPath());
            if ($image->getWidth() > self::MAX_WIDTH) {
                $image->width(self::MAX_WIDTH);
            }
            $image->format('webp')->save($temporary);

            Storage::disk('media')->put($path, (string) file_get_contents($temporary), [
                'visibility' => 'public',
                'ContentType' => 'image/webp',
                'CacheControl' => 'public, max-age=31536000, immutable',
            ]);
        } finally {
            @unlink($reserved);
            @unlink($temporary);
        }

        $media = Media::create([
            'path' => $path,
            'width' => $image->getWidth(),
            'height' => $image->getHeight(),
            'mime' => 'image/webp',
            'alt_default' => $data['alt'] ?? null,
        ]);

        return new MediaResource($media);
    }
}
