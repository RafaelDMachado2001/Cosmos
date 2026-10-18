<?php

declare(strict_types=1);

namespace App\Http\Resources\Admin;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

class MediaResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->resource->id,
            'url' => Storage::disk('media')->url($this->resource->path),
            'width' => $this->resource->width,
            'height' => $this->resource->height,
            'mime' => $this->resource->mime,
            'altDefault' => $this->resource->alt_default,
        ];
    }
}
