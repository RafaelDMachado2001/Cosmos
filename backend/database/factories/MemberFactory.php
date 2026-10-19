<?php

namespace Database\Factories;

use App\Modules\Identity\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Member>
 */
class MemberFactory extends Factory
{
    protected $model = Member::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->name(),
            'handle' => fake()->unique()->regexify('[a-z]{6}[0-9]{4}'),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            'locale' => 'pt',
        ];
    }
}
