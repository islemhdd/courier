<?php

use App\Models\User;

test('api user endpoint requires authentication', function () {
    $this->getJson('/api/user')
        ->assertUnauthorized();
});

test('active users can authenticate through the api', function () {
    $user = User::factory()->create([
        'email' => 'admin@example.test',
    ]);

    $this->withHeader('Origin', 'http://localhost:5173')
        ->postJson('/api/login', [
            'email' => 'admin@example.test',
            'password' => 'password',
            'remember' => true,
        ])
        ->assertOk()
        ->assertJsonPath('user.id', $user->id)
        ->assertJsonPath('user.email', 'admin@example.test');

    $this->assertAuthenticatedAs($user);
});

test('inactive users cannot authenticate through the api', function () {
    User::factory()->create([
        'email' => 'inactive@example.test',
        'actif' => false,
    ]);

    $this->withHeader('Origin', 'http://localhost:5173')
        ->postJson('/api/login', [
            'email' => 'inactive@example.test',
            'password' => 'password',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('email');

    $this->withHeader('Origin', 'http://localhost:5173')
        ->getJson('/api/user')
        ->assertUnauthorized();
});

test('authenticated users can logout through the api', function () {
    User::factory()->create([
        'email' => 'logout@example.test',
    ]);

    $this->withHeader('Origin', 'http://localhost:5173')
        ->postJson('/api/login', [
            'email' => 'logout@example.test',
            'password' => 'password',
        ])
        ->assertOk();

    $this->assertAuthenticated();

    $this->withHeader('Origin', 'http://localhost:5173')
        ->postJson('/api/logout')
        ->assertOk()
        ->assertJsonPath('message', 'Session fermee.');

    $this->withHeader('Origin', 'http://localhost:5173')
        ->getJson('/api/user')
        ->assertUnauthorized();
});
